import bluebird from "bluebird";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import duration from "dayjs/plugin/duration";

import { WorkContext, Work, CommandContainer } from "./ctx";
import {
  BillingScheme,
  ComLinear,
  Counter,
  PRICE_MODEL,
  PriceModel,
} from "../props/com";
import { Activity, Identification, IdentificationKeys } from "../props";
import { DemandBuilder } from "../props/builder";

import * as rest from "../rest";
import { OfferProposal } from "../rest/market";
import { Allocation, Invoice } from "../rest/payment";
import { Agreement } from "../rest/market";

import * as gftp from "../storage/gftp";
import {
  applyMixins,
  AsyncExitStack,
  asyncWith,
  CancellationToken,
  logger,
  Queue,
  sleep,
} from "../utils";
import * as _vm from "./vm";

dayjs.extend(duration);
dayjs.extend(utc);

const cancellationToken = new CancellationToken();

let cancellationHandler = () => {
  if (!cancellationToken.cancelled) {
    cancellationToken.cancel();
  }
}

["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP", "exit", "uncaughtException"].forEach((event) => {
    process.on(event, cancellationHandler);
});

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
  private _stack;
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
    this._stack = new AsyncExitStack();
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
      this._budget_allocation = await this._stack.enter_async_context(
        this._payment_api.new_allocation(
          this._budget_amount,
          this._expires.add(CFG_INVOICE_TIMEOUT, "ms")
        )
      );
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
    let work_queue: Queue<Task> = new Queue([], cancellationToken);
    let event_queue: Queue<[
      string,
      string,
      string | number | null,
      {}
    ]> = new Queue([], cancellationToken);

    let workers: Set<any> = new Set(); //asyncio.Task[]
    let last_wid = 0;
    let self = this;

    let agreements_to_pay: Set<string> = new Set();
    let invoices: Map<string, Invoice> = new Map();
    let payment_closing: boolean = false;

    async function process_invoices() {
      let allocation = self._budget_allocation;
      for await (let invoice of self._payment_api.incoming_invoices(
        cancellationToken
      )) {
        if (agreements_to_pay.has(invoice.agreementId)) {
          agreements_to_pay.delete(invoice.agreementId);
          await invoice.accept(invoice.amount, allocation);
        } else {
          invoices[invoice.agreementId] = invoice;
        }
        if (payment_closing && agreements_to_pay.size === 0) {
          break;
        }
      }
    }

    async function accept_payment_for_agreement(
      agreement_id: string
    ): Promise<boolean> {
      let allocation = self._budget_allocation;
      emit_progress("agr", "payment_prep", agreement_id);
      if (!invoices.has(agreement_id)) {
        agreements_to_pay.add(agreement_id);
        emit_progress("agr", "payment_queued", agreement_id);
        return false;
      }
      let inv = invoices.get(agreement_id);
      invoices.delete(agreement_id);
      emit_progress("agr", "payment_accept", agreement_id, inv);
      if (allocation != null && inv != null) {
        await inv.accept(inv.amount, allocation);
      }
      return true;
    }

    async function _tmp_log() {
      while (true) {
        if (cancellationToken.cancelled) break;
        let [label, direction, info, rest] = await event_queue.get();
        logger.debug(
          `[${label}] [${direction}] ${info} ${JSON.stringify(rest)}`
        );
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
      await asyncWith(
        await builder.subscribe(market_api),
        async (subscription) => {
          emit_progress("sub", "created", subscription.id());
          for await (let proposal of subscription.events(cancellationToken)) {
            emit_progress("prop", "recv", proposal.id(), proposal.issuer());
            let score = await strategy.score_offer(proposal);
            if (score < SCORE_NEUTRAL) {
              let [proposal_id, provider_id] = [
                proposal.id(),
                proposal.issuer(),
              ];
              try {
                await proposal.reject();
                emit_progress("prop", "rejected", proposal_id, provider_id);
              } catch(error) {
                //suppress and log the error and continue;
                logger.log('debug', `Reject error: ${error}`);
              }
              continue;
            }
            if (proposal.is_draft()) {
              emit_progress("prop", "buffered", proposal.id());
              offer_buffer[proposal.issuer()] = new _BufferItem(
                Date.now(),
                score,
                proposal
              );
            } else {
              try {
                await proposal.respond(builder.props(), builder.cons());
                emit_progress("prop", "respond", proposal.id());
              } catch(error) {
                //suppress and log the error and continue;
                logger.log('debug', `Respond error: ${error}`);
              }
            }
          }
        }
      );
    }

    let storage_manager = await this._stack.enter_async_context(
      gftp.provider()
    );
    logger.debug("post");

    async function start_worker(agreement: Agreement) {
      let wid = last_wid;
      last_wid += 1;

      let details = await agreement.details();
      let provider_info = details.view_prov(new Identification());
      emit_progress(
        "wkr",
        "created",
        wid,
        agreement.id(),
        `provider: ${provider_info["name"].value}`
      );

      async function* task_emiter() {
        while (true) {
          if (cancellationToken.cancelled) break;
          try {
            let item = await work_queue.get();
            item._add_callback(on_work_done);
            emit_progress("wkr", "get-work", wid, item.status());
            item._start(emit_progress);
            yield item;
          } catch(error) {
            break;
          }
        }
        return;
      }

      await asyncWith(
        await activity_api.new_activity(agreement.id()),
        async (act) => {
          emit_progress("act", "create", act.id);

          let work_context = new WorkContext(`worker-${wid}`, storage_manager);
          for await (let batch of worker(work_context, task_emiter())) {
            await batch.prepare();
            logger.info("batch prepared");
            let cc = new CommandContainer();
            batch.register(cc);
            let remote = await act.send(cc.commands());
            logger.info("new batch !!!");
            for await (let step of remote) {
              let message = step.message ? step.message.slice(0, 25) : null;
              let idx = step.idx;
              emit_progress("wkr", "step", wid, message, idx);
            }
            emit_progress("wkr", "get-results", wid);
            await batch.post();
            emit_progress("wkr", "batch-done", wid);
            await accept_payment_for_agreement(agreement.id());
          }

          await accept_payment_for_agreement(agreement.id());
          emit_progress("wkr", "done", wid, agreement.id());
        }
      );
    }

    async function worker_starter() {
      while (true) {
        if (cancellationToken.cancelled) break;
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
          let [provider_id, buffer] = _sample;
          delete offer_buffer[provider_id];

          let task: any | null = null;
          let agreement: Agreement | null = null;

          try {
            agreement = await (buffer as _BufferItem).proposal.agreement();
            const provider_info = (await agreement.details()).view_prov(
              new Identification()
            );
            emit_progress(
              "agr",
              "create",
              agreement.id(),
              `provider: ${provider_info["name"].value}`
            );
            await agreement.confirm();
            emit_progress("agr", "confirm", agreement.id());
            task = loop.create_task(start_worker.bind(null, agreement));
            workers.add(task);
          } catch (error) {
            if (task) task.cancel();
            emit_progress(
              "prop",
              "fail",
              (buffer as _BufferItem).proposal.id(),
              error.toString()
            );
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
      bluebird.Promise.config({ cancellation: true });
      return {
        create_task: bluebird.coroutine(function* (fn): any {
          yield new bluebird.Promise(async (resolve, reject, onCancel) => {
            try {
              await fn();
              resolve();
            } catch (error) {
              reject(error);
            }
            onCancel!(() => {
              logger.warn("cancelled!");
              reject("cancelled!");
            });
          });
        }) as any,
      };
    }

    async function promise_timeout(seconds: number) {
      return bluebird.coroutine(function* (): any {
        yield sleep(seconds);
      })();
    }

    let loop = get_event_loop();
    let find_offers_task = loop.create_task(find_offers);
    let process_invoices_job = loop.create_task(process_invoices);
    try {
      let task_fill_q = loop.create_task(fill_work_q);
      let services: any = [
        find_offers_task,
        loop.create_task(_tmp_log),
        task_fill_q,
        loop.create_task(worker_starter),
        process_invoices_job,
      ];
      while (
        [...services].indexOf(task_fill_q) > -1 ||
        !work_queue.empty() ||
        tasks_processed["s"] > tasks_processed["c"]
      ) {
        if (cancellationToken.cancelled) { throw new Error("Cancelled"); }
        await bluebird.Promise.any([
          ...services,
          ...workers,
          promise_timeout(10),
        ]);
        workers = new Set([...workers].filter((x) => x.isPending()));
        services = new Set([...services].filter((x) => x.isPending()));
      }
      yield { stage: "all work done" };
      logger.info("all work done");
      for (let service of [...services]) {
        service.cancel();
      }
    } catch (error) {
      logger.error(`fail= ${error}`);
    } finally {
      payment_closing = true;
      for (let worker_task of [...workers]) {
        worker_task.cancel();
      }

      find_offers_task.cancel();
    }

    yield { stage: "wait for invoices", agreements_to_pay: agreements_to_pay };
    payment_closing = true;
    await bluebird.Promise.any([
      Promise.all([process_invoices_job]),
      promise_timeout(15),
    ]);
    cancellationToken.cancel();
    yield { done: true };
    // process.abort(); //until cleanup for async branches implemented properly
    return;
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
  async done(this) {
    this._market_api = null;
    this._payment_api = null;
    await this._stack.aclose();
  }
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

  status() {
    return this._status;
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
      this._emit_event("task", "accept", null, result);
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
