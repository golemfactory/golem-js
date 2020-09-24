import {
  BillingScheme,
  ComLinear,
  Counter,
  PRICE_MODEL,
  PriceModel,
} from "../props/com";
import { Activity, Identification, IdentificationKeys } from "../props";
import { DemandBuilder } from "../props/builder";
import { OfferProposal, Subscription } from "../rest/market";
import { Allocation } from "../rest/payment";
import rest from "../rest";
import { Agreement } from "../rest/market";
import { sleep, applyMixins, Queue } from "../utils";
import * as gftp from "../storage/gftp";
import { WorkContext, Work, CommandContainer } from "./ctx";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import duration from "dayjs/plugin/duration";
import blue, { Promise as bluePromise } from "bluebird";
import * as _vm from "./vm";

dayjs.extend(duration);
dayjs.extend(utc);
const CFG_INVOICE_TIMEOUT: any = dayjs
  .duration({ minutes: 5 })
  .asMilliseconds();
//"Time to receive invoice from provider after tasks ended."

const SCORE_NEUTRAL: number = 0.0;
const SCORE_REJECTED: number = -1.0;
const SCORE_TRUSTED: number = 100.0;

const CFF_DEFAULT_PRICE_FOR_COUNTER: Map<Counter, number> = new Map([
  [Counter.TIME, parseFloat("0.002")],
  [Counter.CPU, parseFloat("0.002") * 10],
]);

export class _EngineConf {
  max_workers: Number = 5;
  timeout: any = dayjs.duration({ minutes: 5 }).asMilliseconds();
  constructor(max_workers, timeout) {
    this.max_workers = max_workers;
    this.timeout = timeout;
  }
}

export class MarketStrategy {
  /*Abstract market strategy*/

  async decorate_demand(demand: DemandBuilder): Promise<void> {}

  async score_offer(offer: OfferProposal): Promise<Number> {
    return SCORE_REJECTED;
  }
}

interface MarketGeneral extends MarketStrategy, Object {}
class MarketGeneral {}

applyMixins(MarketGeneral, [MarketStrategy, Object]);

export class DummyMS extends MarketGeneral {
  max_for_counter: Map<Counter, Number> = CFF_DEFAULT_PRICE_FOR_COUNTER;
  max_fixed: Number = parseFloat("0.05");
  _activity?: Activity;

  async decorate_demand(demand: DemandBuilder): Promise<void> {
    demand.ensure(`(${PRICE_MODEL}=${PriceModel.LINEAR})`);
    this._activity = new Activity().from_props(demand._props);
  }

  async score_offer(offer: OfferProposal): Promise<Number> {
    const linear: ComLinear = new ComLinear().from_props(offer.props());

    if (linear.scheme.value != BillingScheme.PAYU) {
      return SCORE_REJECTED;
    }

    if (linear.fixed_price > this.max_fixed) return SCORE_REJECTED;

    for (const [counter, price] of Object.entries(linear.price_for)) {
      if (!this.max_for_counter.has(counter as Counter)) return SCORE_REJECTED;
      if (price > <any>this.max_for_counter.get(counter as Counter))
        return SCORE_REJECTED;
    }

    return SCORE_NEUTRAL;
  }
}

export class LeastExpensiveLinearPayuMS {
  private _expected_time_secs: number;
  constructor(expected_time_secs: number = 60) {
    this._expected_time_secs = expected_time_secs;
  }

  async decorate_demand(demand: DemandBuilder): Promise<void> {
    demand.ensure(`({com.PRICE_MODEL}={com.PriceModel.LINEAR.value})`);
  }

  async score_offer(offer: OfferProposal): Promise<Number> {
    const linear: ComLinear = new ComLinear().from_props(offer.props);

    if (linear.scheme.value != BillingScheme.PAYU) return SCORE_REJECTED;

    const known_time_prices = [Counter.TIME, Counter.CPU];

    for (const counter in Object.keys(linear.price_for)) {
      if (!(counter in known_time_prices)) return SCORE_REJECTED;
    }

    if (linear.fixed_price < 0) return SCORE_REJECTED;
    let expected_price = linear.fixed_price;

    for (const resource in known_time_prices) {
      if (linear.price_for[resource] < 0) return SCORE_REJECTED;
      expected_price += linear.price_for[resource] * this._expected_time_secs;
    }

    // The higher the expected price value, the lower the score.
    // The score is always lower than SCORE_TRUSTED and is always higher than 0.
    const score: number = (SCORE_TRUSTED * 1.0) / (expected_price + 1.01);

    return score;
  }
}

export class _BufferItem {
  public ts!: Date; //datetime
  public score!: Number;
  public proposal!: OfferProposal;
  constructor(ts, score, proposal) {
    this.ts = ts;
    this.score = score;
    this.proposal = proposal;
  }
}

interface CallableWork {
  (ctx: WorkContext, tasks: AsyncIterable<any>): AsyncGenerator<Work>; //WorkContext | AsyncGenerator<"Task"> |
}

export class Engine {
  private _subnet;
  private _strategy;
  private _api_config;
  private _package;
  private _conf;
  private _expires;
  private _budget_amount;
  private _budget_allocation: Allocation | null;

  private _activity_api;
  private _market_api;
  private _payment_api;

  constructor(
    _package: _vm.Package,
    max_workers: Number = 5,
    timeout: any = dayjs.duration({ minutes: 5 }).asMilliseconds(), //timedelta
    budget: string, //number
    strategy: MarketStrategy = new DummyMS(),
    subnet_tag?: string
  ) {
    this._subnet = subnet_tag;
    this._strategy = strategy;
    this._api_config = new rest.Configuration();
    this._package = _package;
    this._conf = new _EngineConf(max_workers, timeout);
    // TODO: setup precision
    this._budget_amount = parseFloat(budget);
    this._budget_allocation = null;
  }

  async *map(worker: CallableWork, data) {
    let tasks_processed = { c: 0, s: 0 };

    function on_work_done(task, status) {
      tasks_processed["c"] += 1;
    }

    // Creating allocation
    if (!this._budget_allocation) {
      await this.ready();
      let allocationTask = this._payment_api.new_allocation(
        this._budget_amount,
        this._expires.add(CFG_INVOICE_TIMEOUT, "ms")
      );
      this._budget_allocation = await allocationTask.ready();
      const result = await this._budget_allocation!.details();
      yield {
        allocation: this._budget_allocation!.id,
        ...result,
      };
    }

    // Building offer
    let builder = new DemandBuilder();
    let _activity = new Activity();
    _activity.expiration.value = this._expires;
    builder.add(_activity);
    builder.add(new Identification(this._subnet));
    if (this._subnet)
      builder.ensure(`(${IdentificationKeys.subnet_tag}=${this._subnet})`);
    await this._package.decorate_demand(builder);
    await this._strategy.decorate_demand(builder);

    let offer_buffer: { [key: string]: string | _BufferItem } = {}; //Dict[str, _BufferItem]
    let market_api = this._market_api;
    let activity_api = this._activity_api;
    let strategy = this._strategy;
    let work_queue: Queue<Task> = new Queue();
    let event_queue: Queue<[
      string,
      string,
      string | number | null,
      {}
    ]> = new Queue();

    let workers: Set<any> = new Set(); //asyncio.Task[]
    let last_wid = 0;
    let self = this;

    let agreements_to_pay: Set<string> = new Set();
    let invoices: Map<string, rest.payment.Invoice> = new Map();
    let payment_closing: boolean = false;

    async function process_invoices() {
      let allocation: rest.payment.Allocation = self._budget_allocation;
      for await (let invoice of self._payment_api.incoming_invoices())
        if (agreements_to_pay.has(invoice.agreement_id)) {
          agreements_to_pay.delete(invoice.agreement_id);
          await invoice.accept(invoice.amount, allocation);
        } else {
          invoices[invoice.agreement_id] = invoice;
        }
        if (payment_closing && agreements_to_pay.size === 0) {
          break;
        }
      }
    }

    async function accept_payment_for_agreement(agreement_id: string): boolean {
      let allocation: rest.payment.Allocation = self._budget_allocation;
      if (!invoices.has(agreement_id)) {
        agreements_to_pay.add(agreement_id);
        return false;
      }
      let inv = invoices.get(agreement_id);
      invoices.delete(agreement_id);
      await inv.accept(inv.amount, allocation);
      return true;
    }

    async function _tmp_log() {
      while (true) {
        let item = await event_queue.get();
        console.log("_tmp_log", ...item);
      }
    }

    function emit_progress(
      resource_type: "sub" | "prop" | "agr" | "act" | "wkr",
      event_type: string,
      resource_id: number | string | null,
      ...rest
    ) {
      event_queue.put([resource_type, event_type, resource_id, rest]);
    }

    async function find_offers() {
      const subscription = (await builder.subscribe(
        market_api
      )) as Subscription;
      emit_progress("sub", "created", subscription.id());
      for await (let proposal of subscription.events()) {
        emit_progress("prop", "recv", proposal.id(), proposal.issuer());
        let score = await strategy.score_offer(proposal);
        if (score < SCORE_NEUTRAL) {
          let [proposal_id, provider_id] = [proposal.id(), proposal.issuer()];
          // with contextlib.suppress(Exception):
          await proposal.reject();
          emit_progress("prop", "rejected", proposal_id, provider_id);
          continue;
        }
        if (proposal.is_draft()) {
          emit_progress("prop", "buffered", proposal.id());
          offer_buffer["ala"] = new _BufferItem(Date.now(), score, proposal);
          offer_buffer[proposal.issuer()] = new _BufferItem(
            Date.now(),
            score,
            proposal
          );
        } else {
          await proposal.respond(builder.props(), builder.cons());
          emit_progress("prop", "respond", proposal.id());
        }
      }
    }

    console.log("pre");
    let storage_manager = await gftp.provider().ready();
    console.log("post");

    async function start_worker(agreement: Agreement) {
      let wid = last_wid;
      last_wid += 1;

      let details = await agreement.details();
      let provider_idn = details.view_prov(new Identification());
      emit_progress(
        "wkr",
        "created",
        wid,
        agreement.id,
        provider_idn
      );

      async function* task_emiter() {
        while (true) {
          let item = await work_queue.get();
          item._add_callback(on_work_done);
          emit_progress("wkr", "get-work", wid, item);
          item._start(emit_progress);
          yield item;
        }
      }

      const act = await activity_api.new_activity(agreement.id());
      emit_progress("act", "create", act.id);

      let work_context = new WorkContext(`worker-${wid}`, storage_manager);
      for await (let batch of worker(work_context, task_emiter())) {
        await batch.prepare();
        console.log("prepared");
        let cc = new CommandContainer();
        batch.register(cc);
        let remote = await act.send(cc.commands());
        console.log("new batch !!!", cc.commands(), remote);
        for await (let step of remote) {
          let message = step.message ? step.message.slice(0, 25) : null;
          let idx = step.idx;
          emit_progress("wkr", "step", wid, message, idx);
        }
        emit_progress("wkr", "get-results", wid);
        await batch.post();
        emit_progress("wkr", "batch-done", wid);
      }

      emit_progress("wkr", "done", wid, agreement.id);
    }

    async function worker_starter() {
      while (true) {
        await sleep(2);
        if (
          Object.keys(offer_buffer).length > 0 &&
          workers.size < self._conf.max_workers
        ) {
          let _offer_list = Object.entries(offer_buffer);
          let _sample =
            _offer_list[
              Math.floor(Math.random() * Object.keys(offer_buffer).length)
            ];
          let [provider_id, b] = _sample;
          delete offer_buffer[provider_id];

          let task: any | null = null;
          let agreement: Agreement | null = null;

          try {
            agreement = await (b as _BufferItem).proposal.agreement();
            emit_progress(
              "agr",
              "create",
              agreement.id(),
              (await agreement.details()).view_prov(new Identification())
            );
            await agreement.confirm();
            emit_progress("agr", "confirm", agreement.id());
            task = loop.create_task(start_worker.bind(null, agreement));
            workers.add(task);
          } catch (e) {
            if (task) task.cancel();
            emit_progress(
              "prop",
              "fail",
              (b as _BufferItem).proposal.id(),
              e.toString()
            );
          } finally {
          }
        }
      }
    }

    async function fill_work_q() {
      for (let task of data) {
        tasks_processed["s"] += 1;
        await work_queue.put(task);
      }
    }

    function get_event_loop() {
      blue.Promise.config({ cancellation: true });
      return {
        create_task: blue.coroutine(function* (fn): any {
          return yield new blue.Promise(async (resolve, reject, onCancel) => {
            try {
              await fn();
              resolve();
            } catch (error) {
              reject(error);
            }
            onCancel!(() => {
              console.log("cancelled!");
              reject("cancelled!");
            });
          });
        }) as any,
      };
    }

    let loop = get_event_loop();
    let find_offers_task = loop.create_task(find_offers);
    try {
      let task_fill_q = loop.create_task(fill_work_q);
      let services: any = [
        find_offers_task,
        loop.create_task(_tmp_log),
        task_fill_q,
        loop.create_task(worker_starter),
      ];
      while (
        [...services].indexOf(task_fill_q) > -1 ||
        !work_queue.empty() ||
        tasks_processed["s"] > tasks_processed["c"]
      ) {
        await bluePromise.any([...services, ...workers]); //add timeout
        workers = new Set([...workers].filter((x) => x.isPending()));
        services = new Set([...services].filter((x) => x.isPending()));
      }
      yield { stage: "all work done" }
      console.log("all work done");
    } catch (e) {
      console.log("fail=", e);
    } finally {
      for (let worker_task of workers) {
        worker_task.cancel();
      }
      find_offers_task.cancel();
      await Promise.all({ ...workers, ...{ find_offers_task } });
    }

    yield { done: true };
  }

  async ready() {
    // TODO: Cleanup on exception here.
    this._expires = dayjs.utc().add(this._conf.timeout, "ms");
    let market_client = await this._api_config.market();
    this._market_api = new rest.Market(market_client);

    let activity_client = await this._api_config.activity();
    this._activity_api = new rest.Activity(activity_client);

    let payment_client = await this._api_config.payment();
    this._payment_api = new rest.Payment(payment_client);
    return this;
  }

  // cleanup, if needed
  // async done(this, exc_type, exc_val, exc_tb) {
  //     // this._market_api = None
  //     // this._payment_api = None
  //     await this._stack.aclose()
  // }
}

export enum TaskStatus {
  WAITING = "WAITING",
  RUNNING = "RUNNING",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
}

class TaskData {}
class TaskResult {}
class TaskGeneral {}
interface TaskGeneral extends TaskData, TaskResult {}

applyMixins(TaskGeneral, [TaskData, TaskResult, Object]);

export class Task extends TaskGeneral {
  private _started: number;
  private _expires: number | null;
  private _emit_event: any;
  private _callbacks!: Set<Function | null>;
  private _result?: TaskResult | null;
  private _data;
  private _status!: TaskStatus;
  constructor(
    data: TaskData,
    expires: number | null = null,
    timeout: number | null = null
  ) {
    super();
    this._started = Date.now();
    this._emit_event = null;
    this._callbacks = new Set();
    if (timeout) this._expires = this._started + timeout;
    else this._expires = expires;

    this._result = null;
    this._data = data;
    this._status = TaskStatus.WAITING;
  }

  _add_callback(callback) {
    this._callbacks.add(callback);
  }

  _start(_emiter) {
    this._status = TaskStatus.RUNNING;
    this._emit_event = _emiter;
  }

  data(): TaskData {
    return this._data;
  }

  output(): TaskResult | null | undefined {
    return this._result;
  }

  expires() {
    return this._expires;
  }

  accept_task(result: TaskResult | null = null) {
    if (this._emit_event) {
      this._emit_event("task", "accept", null, (result = result));
    }
    if (this._status != TaskStatus.RUNNING) throw "";
    this._status = TaskStatus.ACCEPTED;
    for (let cb of this._callbacks) cb && cb(this, "accept");
  }

  reject_task() {
    if (this._status != TaskStatus.RUNNING) throw "";
    this._status = TaskStatus.REJECTED;
  }
}

export const vm = _vm;
