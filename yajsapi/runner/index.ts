import bluebird, { TimeoutError } from "bluebird";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import duration from "dayjs/plugin/duration";
import { MarketDecoration } from "ya-ts-client/dist/ya-payment/src/models";

import { WorkContext, Work, CommandContainer } from "./ctx";
import * as events from "./events";
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
import { OfferProposal, Subscription } from "../rest/market";
import { Allocation, Invoice } from "../rest/payment";
import { Agreement } from "../rest/market";

import * as gftp from "../storage/gftp";
import {
  applyMixins,
  AsyncExitStack,
  asyncWith,
  AsyncWrapper,
  Callable,
  CancellationToken,
  eventLoop,
  logger,
  Queue,
  sleep,
} from "../utils";

import * as _common from "./common";
import * as _vm from "./vm";
import * as _sgx from "./sgx";
export const sgx = _sgx;
export const vm = _vm;
import { Task, TaskStatus } from "./task";
import { Consumer, SmartQueue } from "./smartq";

export { Task, TaskStatus };

dayjs.extend(duration);
dayjs.extend(utc);

const SIGNALS = ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"];

const CFG_INVOICE_TIMEOUT: number = dayjs
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
  timeout: number = dayjs.duration({ minutes: 5 }).asMilliseconds();
  get_offers_timeout: number = dayjs.duration({ seconds: 20 }).asMilliseconds();
  traceback: boolean = false; //TODO fix
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
    demand.ensure(`(${PRICE_MODEL}=${PriceModel.LINEAR})`);
  }

  async score_offer(offer: OfferProposal): Promise<Number> {
    const linear: ComLinear = new ComLinear().from_props(offer.props());

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

type D = "D"; // Type var for task data
type R = "R"; // Type var for task result

export class Engine {
  private _subnet;
  private _strategy;
  private _api_config;
  private _stack;
  private _demand_decor;
  private _conf;
  private _expires;
  private _budget_amount;
  private _budget_allocations: Allocation[];

  private _activity_api;
  private _market_api;
  private _payment_api;

  private _wrapped_emitter;
  private _cancellation_token: CancellationToken;
  private _worker_cancellation_token: CancellationToken;

  constructor(
    _demand_decor: _common.DemandDecor,
    max_workers: Number = 5,
    timeout: any = dayjs.duration({ minutes: 5 }).asMilliseconds(), //timedelta
    budget: string, //number
    strategy: MarketStrategy = new DummyMS(),
    subnet_tag?: string,
    event_emitter?: Callable<[events.YaEvent], void> //TODO not default event
  ) {
    this._subnet = subnet_tag;
    this._strategy = strategy;
    this._api_config = new rest.Configuration();
    this._stack = new AsyncExitStack();
    this._demand_decor = _demand_decor;
    this._conf = new _EngineConf(max_workers, timeout);
    // TODO: setup precision
    this._budget_amount = parseFloat(budget);
    this._budget_allocations = [];

    this._cancellation_token = new CancellationToken();
    let cancellationToken = this._cancellation_token;

    this._worker_cancellation_token = new CancellationToken();

    function cancel(e) {
      if (cancellationToken && !cancellationToken.cancelled) {
        cancellationToken.cancel();
      }
      SIGNALS.forEach((event) => {
        process.off(event, cancel);
      });
    }
    SIGNALS.forEach((event) => process.on(event, cancel));

    if (!event_emitter) {
      //from ..log import log_event
      // event_emitter = log_event
    }
    this._wrapped_emitter =
      event_emitter && new AsyncWrapper(event_emitter, null, cancellationToken);
  }

  async *map(
    worker: Callable<
      [WorkContext, AsyncIterable<Task<D, R>>],
      AsyncGenerator<Work>
    >,
    data: Iterable<Task<D, R>>
  ): AsyncGenerator<Task<D, R>> {
    const emit = <Callable<[events.YaEvent], void>>(
      this._wrapped_emitter.async_call.bind(this._wrapped_emitter)
    );

    const multi_payment_decoration = await this._create_allocations();

    emit(new events.ComputationStarted());
    // Building offer
    let builder = new DemandBuilder();
    let _activity = new Activity();
    _activity.expiration.value = this._expires;
    builder.add(_activity);
    builder.add(new Identification(this._subnet));
    if (this._subnet)
      builder.ensure(`(${IdentificationKeys.subnet_tag}=${this._subnet})`);
    for (let constraint of multi_payment_decoration.constraints) {
      builder.ensure(constraint);
    }
    for (let x of multi_payment_decoration.properties) {
      builder._props[x.key] = x.value;
    }
    await this._demand_decor.decorate_demand(builder);
    await this._strategy.decorate_demand(builder);

    let offer_buffer: { [key: string]: string | _BufferItem } = {}; //Dict[str, _BufferItem]
    let market_api = this._market_api;
    let activity_api = this._activity_api;
    let strategy = this._strategy;
    let cancellationToken = this._cancellation_token;
    let done_queue: Queue<Task<D, R>> = new Queue([], cancellationToken);

    function on_task_done(task: Task<D, R>, status: TaskStatus): void {
      if (status === TaskStatus.ACCEPTED) done_queue.put(task); //put_nowait
    }

    function* input_tasks(): Iterable<Task<D, R>> {
      for (let task of data) {
        task._add_callback(on_task_done);
        yield task;
      }
    }

    let work_queue = new SmartQueue([...input_tasks()]);

    let workers: Set<any> = new Set(); //asyncio.Task[]
    let last_wid = 0;
    let self = this;

    let agreements_to_pay: Set<string> = new Set();
    let invoices: Map<string, Invoice> = new Map();
    let payment_closing: boolean = false;
    let secure = this._demand_decor.secure;

    let offers_collected = 0;
    let proposals_confirmed = 0;

    async function process_invoices(): Promise<void> {
      for await (let invoice of self._payment_api.incoming_invoices(
        cancellationToken
      )) {
        if (agreements_to_pay.has(invoice.agreementId)) {
          emit(
            new events.InvoiceReceived({
              agr_id: invoice.agreementId,
              inv_id: invoice.invoiceId,
              amount: invoice.amount,
            })
          );
          emit(new events.CheckingPayments());
          const allocation = self.allocation_for_invoice(invoice);
          try {
            await invoice.accept(invoice.amount, allocation);
            agreements_to_pay.delete(invoice.agreementId);
            emit(
              new events.PaymentAccepted({
                agr_id: invoice.agreementId,
                inv_id: invoice.invoiceId,
                amount: invoice.amount,
              })
            );
          } catch (e) {
            emit(new events.PaymentFailed({ agr_id: invoice.agreementId }));
          }
        } else {
          invoices[invoice.agreementId] = invoice;
        }
        if (payment_closing && agreements_to_pay.size === 0) {
          break;
        }
      }
    }

    async function accept_payment_for_agreement({
      agreement_id,
      partial,
    }): Promise<void> {
      emit(new events.PaymentPrepared({ agr_id: agreement_id }));
      let inv = invoices.get(agreement_id);
      if (!inv) {
        agreements_to_pay.add(agreement_id);
        emit(new events.PaymentQueued({ agr_id: agreement_id }));
        return;
      }
      invoices.delete(agreement_id);
      const allocation = self.allocation_for_invoice(inv);
      await inv.accept(inv.amount, allocation);
      emit(
        new events.PaymentAccepted({
          agr_id: agreement_id,
          inv_id: inv.invoiceId,
          amount: inv.amount,
        })
      );
    }

    async function find_offers(): Promise<void> {
      let _subscription: Subscription;
      try {
        _subscription = await builder.subscribe(market_api);
      } catch (error) {
        emit(new events.SubscriptionFailed({ reason: error }));
        throw error;
      }
      await asyncWith(_subscription, async (subscription) => {
        emit(new events.SubscriptionCreated({ sub_id: subscription.id() }));
        let _proposals;
        try {
          _proposals = subscription.events(self._worker_cancellation_token);
        } catch (error) {
          emit(
            new events.CollectFailed({
              sub_id: subscription.id(),
              reason: error,
            })
          );
        }
        for await (let proposal of _proposals) {
          emit(
            new events.ProposalReceived({
              prop_id: proposal.id(),
              provider_id: proposal.issuer(),
            })
          );
          offers_collected += 1;
          let score;
          try {
            score = await strategy.score_offer(proposal);
          } catch (error) {
            emit(
              new events.ProposalRejected({
                prop_id: proposal.id(),
                reason: error,
              })
            );
            continue;
          }
          if (score < SCORE_NEUTRAL) {
            try {
              await proposal.reject();
              emit(new events.ProposalRejected({ prop_id: proposal.id() }));
            } catch (error) {
              //suppress and log the error and continue;
              logger.log("debug", `Reject error: ${error}`);
            }
            continue;
          }
          if (!proposal.is_draft()) {
            try {
              const common_platforms = self._get_common_payment_platforms(
                proposal
              );
              if (common_platforms.length) {
                builder._props["golem.com.payment.chosen-platform"] =
                  common_platforms[0];
              } else {
                try {
                  await proposal.reject();
                  emit(
                    new events.ProposalRejected({
                      prop_id: proposal.id,
                      reason: "No common payment platforms",
                    })
                  );
                } catch (error) {
                  //suppress error
                }
              }
              await proposal.respond(builder.props(), builder.cons());
              emit(new events.ProposalResponded({ prop_id: proposal.id() }));
            } catch (error) {
              emit(
                new events.ProposalFailed({
                  prop_id: proposal.id(),
                  reason: error,
                })
              );
            }
          } else {
            emit(new events.ProposalConfirmed({ prop_id: proposal.id() }));
            offer_buffer[proposal.issuer()] = new _BufferItem(
              Date.now(),
              score,
              proposal
            );
            proposals_confirmed += 1;
          }
        }
      });
    }

    let storage_manager = await this._stack.enter_async_context(
      gftp.provider()
    );

    async function start_worker(agreement: Agreement): Promise<void> {
      let wid = last_wid;
      last_wid += 1;

      emit(new events.WorkerStarted({ agr_id: agreement.id() }));

      let _act;
      try {
        _act = await activity_api.create_activity(agreement, secure);
      } catch (error) {
        emit(new events.ActivityCreateFailed({ agr_id: agreement.id() }));
        throw error;
      }

      async function* task_emitter(
        consumer: Consumer<any>
      ): AsyncGenerator<Task<"TaskData", "TaskResult">> {
        for await (let handle of consumer) {
          yield Task.for_handle(handle, work_queue, emit);
        }
      }

      await asyncWith(
        _act,
        async (act): Promise<void> => {
          emit(
            new events.ActivityCreated({
              act_id: act.id,
              agr_id: agreement.id(),
            })
          );

          let work_context = new WorkContext(
            `worker-${wid}`,
            storage_manager,
            emit
          );
          await asyncWith(work_queue.new_consumer(), async (consumer) => {
            let command_generator = worker(
              work_context,
              task_emitter(consumer)
            );
            for await (let batch of command_generator) {
              try {
                let current_worker_task = consumer.last_item();
                if (current_worker_task) {
                  emit(
                    new events.TaskStarted({
                      agr_id: agreement.id(),
                      task_id: current_worker_task.id,
                      task_data: current_worker_task.data(),
                    })
                  );
                }
                let task_id = current_worker_task
                  ? current_worker_task.id
                  : null;
                batch.attestation = {
                  credentials: act.credentials,
                  nonce: act.id,
                  exeunitHashes: act.exeunitHashes,
                };
                await batch.prepare();
                let cc = new CommandContainer();
                batch.register(cc);
                let remote = await act.exec(cc.commands());
                emit(
                  new events.ScriptSent({
                    agr_id: agreement.id(),
                    task_id: task_id,
                    cmds: cc.commands(),
                  })
                );
                emit(new events.CheckingPayments());
                try {
                  for await (let step of remote) {
                    batch.output.push(step);
                    emit(
                      new events.CommandExecuted({
                        success: true,
                        agr_id: agreement.id(),
                        task_id: task_id,
                        command: cc.commands()[step.idx],
                        message: step.message,
                        cmd_idx: step.idx,
                      })
                    );
                  }
                } catch (error) {
                  // assert len(err.args) >= 2
                  const { name: cmd_idx, description } = error;
                  //throws new CommandExecutionError from activity#355
                  if (cmd_idx) {
                    emit(
                      new events.CommandExecuted({
                        success: false,
                        agr_id: agreement.id(),
                        task_id: task_id,
                        command: cc.commands()[cmd_idx],
                        message: description,
                        cmd_idx: cmd_idx,
                      })
                    );
                  }
                  throw error;
                }
                emit(
                  new events.GettingResults({
                    agr_id: agreement.id(),
                    task_id: task_id,
                  })
                );
                await batch.post();
                emit(
                  new events.ScriptFinished({
                    agr_id: agreement.id(),
                    task_id: task_id,
                  })
                );
                await accept_payment_for_agreement({
                  agreement_id: agreement.id(),
                  partial: true,
                });
              } catch (error) {
                try {
                  await command_generator.throw(error);
                } catch (error) {
                  emit(
                    new events.WorkerFinished({
                      agr_id: agreement.id(),
                      exception: error,
                    })
                  );
                  return;
                }
              }
            }
          });
          await accept_payment_for_agreement({
            agreement_id: agreement.id(),
            partial: false,
          });
          emit(
            new events.WorkerFinished({
              agr_id: agreement.id(),
              exception: undefined,
            })
          );
        }
      );
    }

    async function worker_starter(): Promise<void> {
      while (true) {
        if (self._worker_cancellation_token.cancelled) break;
        await sleep(2);
        if (
          Object.keys(offer_buffer).length > 0 &&
          workers.size < self._conf.max_workers &&
          work_queue.has_unassigned_items()
        ) {
          let _offer_list = Object.entries(offer_buffer);
          let _sample =
            _offer_list[
              Math.floor(Math.random() * Object.keys(offer_buffer).length)
            ];
          let [provider_id, buffer] = _sample;
          delete offer_buffer[provider_id];

          let new_task: any | null = null;
          let agreement: Agreement | null = null;
          try {
            agreement = await (buffer as _BufferItem).proposal.agreement();
            const provider_info = (await agreement.details()).view_prov(
              new Identification()
            );
            emit(
              new events.AgreementCreated({
                agr_id: agreement.id(),
                provider_id: provider_info,
              })
            );
            if (!(await agreement.confirm())) {
              emit(new events.AgreementRejected({ agr_id: agreement.id() }));
              continue;
            }
            emit(new events.AgreementConfirmed({ agr_id: agreement.id() }));
            new_task = loop.create_task(start_worker.bind(null, agreement));
            workers.add(new_task);
          } catch (error) {
            if (new_task) new_task.cancel();
            emit(
              new events.ProposalFailed({
                prop_id: (buffer as _BufferItem).proposal.id(),
                reason: error.toString(),
              })
            );
          }
        }
      }
    }

    async function promise_timeout(seconds: number) {
      return bluebird.coroutine(function* (): any {
        yield sleep(seconds);
      })();
    }

    let loop = eventLoop();
    let find_offers_task = loop.create_task(find_offers);
    let process_invoices_job = loop.create_task(process_invoices);
    let wait_until_done = loop.create_task(
      work_queue.wait_until_done.bind(work_queue)
    );
    let get_offers_deadline = dayjs.utc() + this._conf.get_offers_timeout;
    let get_done_task: any = null;
    let worker_starter_task = loop.create_task(worker_starter);
    let services: any = [
      find_offers_task,
      worker_starter_task,
      process_invoices_job,
      wait_until_done,
    ];
    try {
      while (services.indexOf(wait_until_done) > -1 || !done_queue.empty()) {
        const now = dayjs.utc();
        if (now > this._expires) {
          throw new TimeoutError(
            `task timeout exceeded. timeout=${this._conf.timeout}`
          );
        }
        if (now > get_offers_deadline && proposals_confirmed == 0) {
          emit(
            new events.NoProposalsConfirmed({
              num_offers: offers_collected,
              timeout: this._conf.get_offers_timeout,
            })
          );
          get_offers_deadline += this._conf.get_offers_timeout;
        }

        if (!get_done_task) {
          get_done_task = loop.create_task(done_queue.get.bind(done_queue));
          services.push(get_done_task);
        }

        await bluebird.Promise.any([
          ...services,
          ...workers,
          promise_timeout(10),
        ]);

        workers = new Set([...workers].filter((worker) => worker.isPending()));
        services = services.filter((service) => service.isPending());

        if (!get_done_task) throw "";
        if (!get_done_task.isPending()) {
          yield await get_done_task;
          if (services.indexOf(get_done_task) > -1) throw "";
          get_done_task = null;
        }
      }
      emit(new events.ComputationFinished());
    } catch (error) {
      if (error === undefined) { // this needs more research
        logger.error("Computation interrupted by the user.");
      } else {
        logger.error(`fail= ${error}`);
      }
      if (!self._worker_cancellation_token.cancelled)
        self._worker_cancellation_token.cancel();
      // TODO: implement ComputationFinished(error)
      emit(new events.ComputationFinished());
    } finally {
      payment_closing = true;
      find_offers_task.cancel();
      worker_starter_task.cancel();
      if (!self._worker_cancellation_token.cancelled)
        self._worker_cancellation_token.cancel();
      try {
        if (workers) {
          for (let worker_task of [...workers]) {
            worker_task.cancel();
          }
          emit(new events.CheckingPayments());
          await bluebird.Promise.any([
            bluebird.Promise.all([...workers]),
            promise_timeout(10),
          ]);
          emit(new events.CheckingPayments());
        }
      } catch (error) {
        logger.error(error);
      }
      await bluebird.Promise.any([
        bluebird.Promise.all([find_offers_task, process_invoices_job]),
        promise_timeout(10),
      ]);
      emit(new events.CheckingPayments());
      if (agreements_to_pay.size > 0) {
        await bluebird.Promise.any([
          process_invoices_job,
          promise_timeout(15),
        ]);
        emit(new events.CheckingPayments());
      }
    }
    emit(new events.PaymentsFinished());
    await sleep(2);
    cancellationToken.cancel();
    return;
  }

  async _create_allocations(): Promise<MarketDecoration> {
    if (!this._budget_allocations.length) {
      for await (let account of this._payment_api.accounts()) {
        let allocation: Allocation = await this._stack.enter_async_context(
          this._payment_api.new_allocation(
            this._budget_amount,
            account.platform,
            account.address,
            this._expires.add(CFG_INVOICE_TIMEOUT, "ms")
          )
        );
        this._budget_allocations.push(allocation);
      }
    }
    if (!this._budget_allocations.length) {
      throw Error(
        "No payment accounts. Did you forget to run 'yagna payment init -r'?"
      );
    }
    let allocation_ids = this._budget_allocations.map((a) => a.id);
    return await this._payment_api.decorate_demand(allocation_ids);
  }

  _get_common_payment_platforms(proposal: OfferProposal): string[] {
    let prov_platforms = Object.keys(proposal.props())
      .filter((prop) => {
        return prop.startsWith("golem.com.payment.platform.");
      })
      .map((prop) => {
        return prop.split(".")[4];
      });
    if (!prov_platforms) {
      prov_platforms = ["NGNT"];
    }
    const req_platforms = this._budget_allocations.map(
      (budget_allocation) => budget_allocation.payment_platform
    );
    return req_platforms.filter(
      (value) => value && prov_platforms.includes(value)
    ) as string[];
  }

  allocation_for_invoice(invoice: Invoice): Allocation {
    try {
      const _allocation = this._budget_allocations.find(
        (allocation) =>
          allocation.payment_platform === invoice.paymentPlatform &&
          allocation.payment_address === invoice.payerAddr
      );
      if (_allocation) return _allocation;
      throw `No allocation for ${invoice.paymentPlatform} ${invoice.payerAddr}.`;
    } catch (error) {
      throw new Error(error);
    }
  }

  async ready(): Promise<Engine> {
    let stack = this._stack;
    // TODO: Cleanup on exception here.
    this._expires = dayjs.utc().add(this._conf.timeout, "ms");
    let market_client = await this._api_config.market();
    this._market_api = new rest.Market(market_client);

    let activity_client = await this._api_config.activity();
    this._activity_api = new rest.Activity(activity_client);

    let payment_client = await this._api_config.payment();
    this._payment_api = new rest.Payment(payment_client);
    await stack.enter_async_context(this._wrapped_emitter);

    return this;
  }

  // cleanup, if needed
  async done(this): Promise<void> {
    this._market_api = null;
    this._payment_api = null;
    await this._stack.aclose();
  }
}
