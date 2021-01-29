import bluebird, { TimeoutError } from "bluebird";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import duration from "dayjs/plugin/duration";
import { MarketDecoration } from "ya-ts-client/dist/ya-payment/src/models";

import { WorkContext, Work, CommandContainer } from "./ctx";
import * as events from "./events";
import { Activity, NodeInfo, NodeInfoKeys } from "../props";
import { DemandBuilder } from "../props/builder";

import * as rest from "../rest";
import { Agreement,  OfferProposal, Subscription } from "../rest/market";
import { Allocation, DebitNote, Invoice } from "../rest/payment";
import { CommandExecutionError } from "../rest/activity";

import * as gftp from "../storage/gftp";
import {
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

import * as _vm from "../package/vm";
import * as _sgx from "../package/sgx";
export const sgx = _sgx;
export const vm = _vm;
import { Task, TaskStatus } from "./task";
import { Consumer, SmartQueue } from "./smartq";
import { LeastExpensiveLinearPayuMS, MarketStrategy, SCORE_NEUTRAL } from "./strategy";
import { Package } from "../package";

export { Task, TaskStatus };

dayjs.extend(duration);
dayjs.extend(utc);

const SIGNALS = ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"];

const DEBIT_NOTE_MIN_TIMEOUT: number = 30; // in seconds
//"Shortest debit note acceptance timeout the requestor will accept."

const DEBIT_NOTE_ACCEPTANCE_TIMEOUT_PROP: string = "golem.com.payment.debit-notes.accept-timeout?";

const CFG_INVOICE_TIMEOUT: number = dayjs
  .duration({ minutes: 5 })
  .asMilliseconds();
//"Time to receive invoice from provider after tasks ended."

const DEFAULT_NETWORK: string = "rinkeby";
const DEFAULT_DRIVER: string = "zksync";

export class NoPaymentAccountError extends Error {
  //"The error raised if no payment account for the required driver/network is available."
  required_driver: string;
  //"Payment driver required for the account."
  required_network: string;
  //"Network required for the account."
  constructor(required_driver, required_network) {
    super(`No payment account available for driver ${required_driver} and network ${required_network}`);
    this.name = this.constructor.name;
    this.required_driver = required_driver;
    this.required_network = required_network;
  }
  toString() {
    return this.message;
  }
}

export class _ExecutorConfig {
  max_workers: Number = 5;
  timeout: number = dayjs.duration({ minutes: 5 }).asMilliseconds();
  get_offers_timeout: number = dayjs.duration({ seconds: 20 }).asMilliseconds();
  traceback: boolean = false; //TODO fix
  constructor(max_workers, timeout) {
    this.max_workers = max_workers;
    this.timeout = timeout;
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


export type ExecutorOpts = {
  task_package: Package;
  max_workers?: Number;
  timeout?: Number | String; //timedelta
  budget: string; //number?
  strategy?: MarketStrategy;
  subnet_tag?: string;
  driver?: string;
  network?: string;
  event_consumer?: Callable<[events.YaEvent], void>; //TODO not default event
};

/**
 * Task executor 
 * 
 * @description Used to run tasks using the specified application package within providers' execution units.
 */
export class Executor {
  private _subnet;
  private _driver;
  private _network;
  private _stream_output;
  private _strategy;
  private _api_config;
  private _stack;
  private _task_package;
  private _conf;
  private _expires;
  private _budget_amount;
  private _budget_allocations: Allocation[];

  private _activity_api;
  private _market_api;
  private _payment_api;

  private _wrapped_consumer;
  private _cancellation_token: CancellationToken;
  private _worker_cancellation_token: CancellationToken;

  /**
   * Create new executor
   * 
   * @param task_package    a package common for all tasks; vm.repo() function may be used to return package from a repository
   * @param max_workers     maximum number of workers doing the computation
   * @param timeout         timeout for the whole computation
   * @param budget          maximum budget for payments
   * @param strategy        market strategy used to select providers from the market (e.g. LeastExpensiveLinearPayuMS or DummyMS)
   * @param subnet_tag      use only providers in the subnet with the subnet_tag name
   * @param driver          name of the payment driver to use or null to use the default driver; only payment platforms with the specified driver will be used
   * @param network         name of the network to use or null to use the default network; only payment platforms with the specified network will be used
   * @param event_consumer  a callable that processes events related to the computation; by default it is a function that logs all events
   */
  constructor({
    task_package,
    max_workers = 5,
    timeout = dayjs.duration({ minutes: 5 }).asMilliseconds(),
    budget,
    strategy = new LeastExpensiveLinearPayuMS(),
    subnet_tag,
    driver,
    network,
    event_consumer,
  }: ExecutorOpts) {
    this._subnet = subnet_tag;
    this._driver = driver ? driver.toLowerCase() : DEFAULT_DRIVER;
    this._network = network ? network.toLowerCase() : DEFAULT_NETWORK;
    this._stream_output = false;
    this._strategy = strategy;
    this._api_config = new rest.Configuration();
    this._stack = new AsyncExitStack();
    this._task_package = task_package;
    this._conf = new _ExecutorConfig(max_workers, timeout);
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

    if (!event_consumer) {
      //from ..log import log_event
      // event_emitter = log_event
    }
    this._wrapped_consumer =
      event_consumer &&
      new AsyncWrapper(event_consumer, null, cancellationToken);
  }

  /**
   * Submit a computation to be executed on providers.
   * 
   * @param worker   a callable that takes a WorkContext object and a list o tasks, adds commands to the context object and yields committed commands
   * @param data     an iterator of Task objects to be computed on providers
   * @returns        yields computation progress events
   */
  async *submit(
    worker: Callable<
      [WorkContext, AsyncIterable<Task<D, R>>],
      AsyncGenerator<Work>
    >,
    data: Iterable<Task<D, R>>
  ): AsyncGenerator<Task<D, R>> {
    const emit = <Callable<[events.YaEvent], void>>(
      this._wrapped_consumer.async_call.bind(this._wrapped_consumer)
    );

    const multi_payment_decoration = await this._create_allocations();

    emit(new events.ComputationStarted({ expires: this._expires }));
    // Building offer
    let builder = new DemandBuilder();
    let _activity = new Activity();
    _activity.expiration.value = this._expires;
    _activity.multi_activity.value = true;
    builder.add(_activity);
    builder.add(new NodeInfo(this._subnet));
    if (this._subnet)
      builder.ensure(`(${NodeInfoKeys.subnet_tag}=${this._subnet})`);
    for (let constraint of multi_payment_decoration.constraints) {
      builder.ensure(constraint);
    }
    for (let x of multi_payment_decoration.properties) {
      builder._properties[x.key] = x.value;
    }
    await this._task_package.decorate_demand(builder);
    await this._strategy.decorate_demand(builder);

    let offer_buffer: { [key: string]: _BufferItem } = {}; //Dict[str, _BufferItem]
    let market_api = this._market_api;
    let activity_api = this._activity_api;
    let strategy = this._strategy;
    let cancellationToken = this._cancellation_token;
    let done_queue: Queue<Task<D, R>> = new Queue([], cancellationToken);
    let stream_output = this._stream_output;

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
    let secure = this._task_package.secure;

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
          const allocation = self._get_allocation(invoice);
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
            emit(new events.PaymentFailed({ agr_id: invoice.agreementId, reason: e.toString() }));
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
      const allocation = self._get_allocation(inv);
      await inv.accept(inv.amount, allocation);
      emit(
        new events.PaymentAccepted({
          agr_id: agreement_id,
          inv_id: inv.invoiceId,
          amount: inv.amount,
        })
      );
    }

    /* TODO Consider processing invoices and debit notes together */
    async function process_debit_notes(): Promise<void> {
      for await (let debit_note of self._payment_api.incoming_debit_notes(
        cancellationToken
      )) {
        if (agreements_to_pay.has(debit_note.agreementId)) {
          emit(new events.DebitNoteReceived({
            agr_id: debit_note.agreementId,
            note_id: debit_note.debitNodeId,
            amount: debit_note.totalAmountDue,
          }));
          const allocation = self._get_allocation(debit_note);
          try {
            await debit_note.accept(debit_note.totalAmountDue, allocation);
          } catch (e) {
            emit(new events.PaymentFailed({ agr_id: debit_note.agreementId, reason: e.toString() }));
          }
        }
        if (payment_closing && agreements_to_pay.size === 0) {
          break;
        }
      }
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
            logger.debug(`Scored offer ${proposal.id()}, ` +
                         `provider: ${proposal.props()["golem.node.id.name"]}, ` +
                         `strategy: ${strategy.constructor.name}, ` +
                         `score: ${score}`);
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
              emit(new events.ProposalRejected({
                prop_id: proposal.id(),
                reason: "Score too low",
              }));
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
                builder._properties["golem.com.payment.chosen-platform"] =
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
              let timeout = proposal.props()[DEBIT_NOTE_ACCEPTANCE_TIMEOUT_PROP];
              if (timeout) {
                if (timeout < DEBIT_NOTE_MIN_TIMEOUT) {
                  try {
                    await proposal.reject();
                  } catch (e) {
                    // with contextlib.suppress(Exception):
                  }
                  emit(
                    new events.ProposalRejected({
                      prop_id: proposal.id,
                      reason: "Debit note acceptance timeout too short",
                    })
                  );
                } else {
                  builder._properties[DEBIT_NOTE_ACCEPTANCE_TIMEOUT_PROP] = timeout;
                }
              }
              await proposal.respond(
                builder.properties(),
                builder.constraints()
              );
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
        _act = await activity_api.new_activity(agreement, secure);
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
              const _batch_timeout = batch.timeout();
              const batch_deadline = _batch_timeout 
                ? dayjs.utc().unix() + _batch_timeout
                : null;
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
                let remote = await act.send(cc.commands(), stream_output, batch_deadline);
                let cmds = cc.commands();
                emit(
                  new events.ScriptSent({
                    agr_id: agreement.id(),
                    task_id,
                    cmds,
                  })
                );
                emit(new events.CheckingPayments());
                for await (let evt_ctx of remote) {
                  let evt = evt_ctx.event(agreement.id(), task_id, cmds);
                  emit(evt);
                  if (evt instanceof events.CommandExecuted && !evt.success) {
                    throw new CommandExecutionError(evt.command, evt.message)
                  }
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
      async function _start_worker(agreement) {
        try {
          await start_worker(agreement);
        } catch (error) {
          logger.error(`Worker finished with error: ${error}`);
        } finally {
          await agreement.terminate();
        }
      }
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
            _offer_list
              .map(x => { return { obj: x, rnd: Math.random() }; })
              .sort((a, b) => a.rnd - b.rnd)
              .map(x => x.obj)
              .reduce((acc, item) => item[1].score > acc[1].score ? item : acc);
          let [provider_id, buffer] = _sample;
          delete offer_buffer[provider_id];

          let new_task: any | null = null;
          let agreement: Agreement | null = null;
          try {
            agreement = await buffer.proposal.create_agreement();
            const node_info = (await agreement.details())
              .provider_view()
              .extract(new NodeInfo());
            emit(
              new events.AgreementCreated({
                agr_id: agreement.id(),
                provider_id: provider_id,
                provider_info: node_info,
              })
            );
            if (!(await agreement.confirm())) {
              emit(new events.AgreementRejected({ agr_id: agreement.id() }));
              continue;
            }
            emit(new events.AgreementConfirmed({ agr_id: agreement.id() }));
            new_task = loop.create_task(_start_worker.bind(null, agreement));
            workers.add(new_task);
          } catch (error) {
            if (new_task) new_task.cancel();
            emit(
              new events.ProposalFailed({
                prop_id: buffer.proposal.id(),
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
    let debit_notes_job = loop.create_task(process_debit_notes);
    let services: any = [
      find_offers_task,
      worker_starter_task,
      process_invoices_job,
      wait_until_done,
      debit_notes_job,
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
      if (error === undefined) {
        // this needs more research
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
        await bluebird.Promise.any([process_invoices_job, promise_timeout(15)]);
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
        let driver = account.driver ? account.driver.toLowerCase() : "";
        let network = account.driver ? account.network.toLowerCase() : "";
        if (driver != this._driver || network != this._network) {
          logger.debug(
            `Not using payment platform ${account.platform}, platform's driver/network ` +
            `${driver}/${network} is different than requested ` +
            `driver/network ${this._driver}/${this._network}`
          );
          continue;
        }
        logger.debug(`Creating allocation using payment platform ${account.platform}`);
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
      if (!this._budget_allocations.length) {
        throw new NoPaymentAccountError(this._driver, this._network);
      }
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

  _get_allocation(item: Invoice | DebitNote): Allocation {
    try {
      const _allocation = this._budget_allocations.find(
        (allocation) =>
          allocation.payment_platform === item.paymentPlatform &&
          allocation.payment_address === item.payerAddr
      );
      if (_allocation) return _allocation;
      throw `No allocation for ${item.paymentPlatform} ${item.payerAddr}.`;
    } catch (error) {
      throw new Error(error);
    }
  }

  async ready(): Promise<Executor> {
    let stack = this._stack;
    // TODO: Cleanup on exception here.
    this._expires = dayjs.utc().add(this._conf.timeout, "ms");
    let market_client = await this._api_config.market();
    this._market_api = new rest.Market(market_client);

    let activity_client = await this._api_config.activity();
    this._activity_api = new rest.Activity(activity_client);

    let payment_client = await this._api_config.payment();
    this._payment_api = new rest.Payment(payment_client);
    await stack.enter_async_context(this._wrapped_consumer);

    return this;
  }

  // cleanup, if needed
  async done(this): Promise<void> {
    this._market_api = null;
    this._payment_api = null;
    await this._stack.aclose();
  }
}
