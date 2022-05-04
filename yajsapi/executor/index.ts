/* eslint @typescript-eslint/no-this-alias: 0 */
/* eslint no-constant-condition: 0 */
import bluebird, { TimeoutError } from "bluebird";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import duration from "dayjs/plugin/duration";
import { MarketDecoration } from "ya-ts-client/dist/ya-payment/src/models";

import { WorkContext, Work, CommandContainer, ExecOptions } from "./ctx";
import * as events from "./events";
import { Activity, NodeInfo, NodeInfoKeys } from "../props";
import { Counter } from "../props/com";
import { DemandBuilder } from "../props/builder";
import { Network } from "../network";

import * as rest from "../rest";
import { Agreement, OfferProposal, Subscription } from "../rest/market";
import { AgreementsPool } from "./agreements_pool";
import { Allocation, DebitNote, Invoice } from "../rest/payment";
import { ActivityService, CommandExecutionError } from "../rest/activity";

import * as csp from "js-csp";

import * as gftp from "../storage/gftp";
import {
  AsyncExitStack,
  asyncWith,
  AsyncWrapper,
  Callable,
  CancellationToken,
  eventLoop,
  logger,
  logUtils,
  promisify,
  Queue,
  sleep,
} from "../utils";

import * as _vm from "../package/vm";
import * as _sgx from "../package/sgx";
export const sgx = _sgx;
export const vm = _vm;
import { Task, TaskStatus } from "./task";
import { Consumer, SmartQueue } from "./smartq";
import {
  DecreaseScoreForUnconfirmedAgreement,
  LeastExpensiveLinearPayuMS,
  MarketStrategy,
  SCORE_NEUTRAL,
} from "./strategy";
import { Package } from "../package";
import axios from "axios";

export { Task, TaskStatus };

dayjs.extend(duration);
dayjs.extend(utc);

const SIGNALS = ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"];

const DEBIT_NOTE_MIN_TIMEOUT = 30; // in seconds
//"Shortest debit note acceptance timeout the requestor will accept."

const DEBIT_NOTE_ACCEPTANCE_TIMEOUT_PROP = "golem.com.payment.debit-notes.accept-timeout?";

const CFG_INVOICE_TIMEOUT: number = dayjs.duration({ minutes: 5 }).asMilliseconds();
//"Time to receive invoice from provider after tasks ended."

const DEFAULT_EXECUTOR_TIMEOUT: number = dayjs.duration({ minutes: 15 }).asMilliseconds();

const DEFAULT_NETWORK: string = process.env["YAGNA_PAYMENT_NETWORK"] || "rinkeby";
const DEFAULT_DRIVER: string = process.env["YAGNA_PAYMENT_DRIVER"] || "erc20";
const DEFAULT_SUBNET: string = process.env["YAGNA_SUBNET"] || "devnet-beta";

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
  max_workers = 5;
  timeout: number = DEFAULT_EXECUTOR_TIMEOUT;
  get_offers_timeout: number = dayjs.duration({ seconds: 20 }).asMilliseconds();
  traceback = false; //TODO fix
  constructor(max_workers, timeout) {
    this.max_workers = max_workers;
    this.timeout = timeout;
  }
}

export class BatchResults {
  results?: events.CommandEvent[];
  error?: any;
}

class AsyncGeneratorBreak extends Error {}

type WorkItem = Work | [Work, ExecOptions];

type D = "D"; // Type var for task data
type R = "R"; // Type var for task result

export type ExecutorOpts = {
  task_package: Package;
  max_workers?: number;
  timeout?: number | string; //timedelta
  budget: string; //number?
  strategy?: MarketStrategy;
  subnet_tag?: string;
  driver?: string; // @deprecated
  network?: string; // @deprecated
  payment_driver?: string;
  payment_network?: string;
  event_consumer?: Callable<[events.YaEvent], void>; //TODO not default event
  network_address?: string;
};

export class SubmissionState {
  builder!: DemandBuilder;
  agreements_pool!: AgreementsPool;
  offers_collected = 0;
  proposals_confirmed = 0;
  payment_cancellation_token: CancellationToken = new CancellationToken();
  worker_cancellation_token: CancellationToken = new CancellationToken();
  constructor(builder: DemandBuilder, agreements_pool: AgreementsPool) {
    this.builder = builder;
    this.agreements_pool = agreements_pool;
  }
}

/**
 * Task executor
 *
 * @description Used to run tasks using the specified application package within providers' execution units.
 */
export class Executor {
  private _subnet;
  private _payment_driver;
  private _payment_network;
  private _stream_output;
  private _strategy;
  private _api_config;
  private _stack;
  private _task_package;
  private _conf;
  private _expires;
  private _budget_amount;
  private _budget_allocations: Allocation[];

  private state?: SubmissionState;

  private _activity_api;
  private _market_api;
  private _payment_api;
  private _net_api;

  private _wrapped_consumer;
  private _active_computations;
  private _chan_computation_done;
  private _cancellation_token: CancellationToken;
  private _event_consumer_cancellation_token: CancellationToken;

  private emit;

  private _network?: Network;
  private _network_address?: string;

  /**
   * Create new executor
   *
   * @param task_package    a package common for all tasks; vm.repo() function may be used to return package from a repository
   * @param max_workers     maximum number of workers doing the computation
   * @param timeout         timeout for the whole computation
   * @param budget          maximum budget for payments
   * @param strategy        market strategy used to select providers from the market (e.g. LeastExpensiveLinearPayuMS or DummyMS)
   * @param subnet_tag      use only providers in the subnet with the subnet_tag name (env variable equivalent: YAGNA_SUBNET)
   * @param driver          @deprecated - it will be removed in a future release
   * @param network         @deprecated - it will be removed in a future release
   * @param payment_driver  name of the payment driver to use or null to use the default driver; only payment platforms with the specified driver will be used (env variable equivalent: YAGNA_PAYMENT_DRIVER)
   * @param payment_network name of the network to use or null to use the default network; only payment platforms with the specified network will be used (env variable equivalent: YAGNA_PAYMENT_NETWORK)
   * @param event_consumer  a callable that processes events related to the computation; by default it is a function that logs all events
   * @param network_address network address for VPN
   */
  constructor({
    task_package,
    max_workers = 5,
    timeout = DEFAULT_EXECUTOR_TIMEOUT,
    budget,
    strategy,
    subnet_tag,
    driver,
    network,
    payment_driver,
    payment_network,
    event_consumer,
    network_address,
  }: ExecutorOpts) {
    this._subnet = subnet_tag ? subnet_tag : DEFAULT_SUBNET;
    this._payment_driver = payment_driver ? payment_driver.toLowerCase() : DEFAULT_DRIVER;
    this._payment_network = payment_network ? payment_network.toLowerCase() : DEFAULT_NETWORK;
    if (driver) {
      logger.warn(
        `The 'driver' parameter is deprecated. It will be removed in a future release. Use 'payment_driver' instead.`
      );
      this._payment_driver = driver.toLowerCase();
    }
    if (network) {
      logger.warn(
        `The 'network' parameter is deprecated. It will be removed in a future release. Use 'payment_network' instead.`
      );
      this._payment_network = network.toLowerCase();
    }
    logger.info(`Using subnet: ${this._subnet}, network: ${this._payment_network}, driver: ${this._payment_driver}`);
    this._stream_output = false;
    this._api_config = new rest.Configuration();
    this._stack = new AsyncExitStack();
    this._task_package = task_package;
    this._conf = new _ExecutorConfig(max_workers, timeout);
    // TODO: setup precision
    this._budget_amount = parseFloat(budget);
    this._strategy =
      strategy ||
      new DecreaseScoreForUnconfirmedAgreement(
        new LeastExpensiveLinearPayuMS(
          60,
          1.0,
          new Map([
            [Counter.TIME, 0.1],
            [Counter.CPU, 0.2],
          ])
        ),
        0.5
      );
    this._budget_allocations = [];

    this._cancellation_token = new CancellationToken();
    const cancellationToken = this._cancellation_token;

    function cancel(event) {
      if (cancellationToken && !cancellationToken.cancelled) {
        cancellationToken.cancel();
      }
      SIGNALS.forEach((event) => {
        process.off(event, cancel);
      });
    }
    SIGNALS.forEach((event) => process.on(event, cancel));

    if (!event_consumer) {
      event_consumer = logUtils.logSummary();
    }
    this._event_consumer_cancellation_token = new CancellationToken();
    this._wrapped_consumer =
      event_consumer && new AsyncWrapper(event_consumer, null, this._event_consumer_cancellation_token);
    this.emit = <Callable<[events.YaEvent], void>>this._wrapped_consumer.async_call.bind(this._wrapped_consumer);
    // Each call to `submit()` will put an item in the channel.
    // The channel can be used to wait until all calls to `submit()` are finished.
    this._chan_computation_done = csp.chan();
    this._active_computations = 0;
    this._network_address = network_address;
  }

  /**
   * Submit a computation to be executed on providers.
   *
   * @param worker   a callable that takes a WorkContext object and a list o tasks, adds commands to the context object and yields committed commands
   * @param data     an iterator of Task objects to be computed on providers
   * @returns        yields computation progress events
   */
  async *submit(
    worker: Callable<[WorkContext, AsyncIterable<Task<D, R>>], AsyncGenerator<WorkItem, any, BatchResults>>,
    data: Iterable<Task<D, R>>
  ): AsyncGenerator<Task<D, R>> {
    this._active_computations += 1;
    const generator = this._submit(worker, data);
    generator.return = async (value) => {
      csp.putAsync(this._chan_computation_done, true);
      await generator.throw(new AsyncGeneratorBreak());
      return { done: true, value: undefined };
    };
    try {
      yield* generator;
    } catch (e) {
      logger.error(e);
    } finally {
      csp.putAsync(this._chan_computation_done, true);
    }
  }

  async _handle_proposal(state: SubmissionState, proposal: OfferProposal): Promise<events.ProposalEvent> {
    const reject_proposal = async (reason: string): Promise<events.ProposalEvent> => {
      await proposal.reject(reason);
      return new events.ProposalRejected({ prop_id: proposal.id(), reason: reason });
    };
    let score;
    try {
      score = await this._strategy.score_offer(proposal, state.agreements_pool);
      logger.debug(
        `Scored offer ${proposal.id()}, ` +
          `provider: ${proposal.props()["golem.node.id.name"]}, ` +
          `strategy: ${this._strategy.constructor.name}, ` +
          `score: ${score}`
      );
    } catch (error) {
      logger.log("debug", `Score offer error: ${error}`);
      return await reject_proposal(`Score offer error: ${error}`);
    }
    if (score < SCORE_NEUTRAL) {
      return await reject_proposal("Score too low");
    }
    if (!proposal.is_draft()) {
      const common_platforms = this._get_common_payment_platforms(proposal);
      if (common_platforms.length) {
        state.builder._properties["golem.com.payment.chosen-platform"] = common_platforms[0];
      } else {
        return await reject_proposal("No common payment platforms");
      }
      const timeout = proposal.props()[DEBIT_NOTE_ACCEPTANCE_TIMEOUT_PROP];
      if (timeout) {
        if (timeout < DEBIT_NOTE_MIN_TIMEOUT) {
          return await reject_proposal("Debit note acceptance timeout too short");
        } else {
          state.builder._properties[DEBIT_NOTE_ACCEPTANCE_TIMEOUT_PROP] = timeout;
        }
      }
      await proposal.respond(state.builder.properties(), state.builder.constraints());
      return new events.ProposalResponded({ prop_id: proposal.id() });
    } else {
      await state.agreements_pool.add_proposal(score, proposal);
      return new events.ProposalConfirmed({ prop_id: proposal.id() });
    }
  }

  async find_offers_for_subscription(
    state: SubmissionState,
    subscription: Subscription,
    emit: Callable<[events.YaEvent], void>
  ): Promise<void> {
    emit(new events.SubscriptionCreated({ sub_id: subscription.id() }));
    const chan_offer_tokens = csp.chan();
    const max_number_of_tasks = 5;
    for (let i = 0; i < max_number_of_tasks; ++i) {
      csp.putAsync(chan_offer_tokens, true);
    }
    let _proposals;
    try {
      _proposals = subscription.events(state.worker_cancellation_token);
    } catch (error) {
      emit(new events.CollectFailed({ sub_id: subscription.id(), reason: error }));
      throw error;
    }
    for await (const proposal of _proposals) {
      emit(new events.ProposalReceived({ prop_id: proposal.id(), provider_id: proposal.issuer() }));
      state.offers_collected += 1;
      const handler = async (pr: OfferProposal) => {
        try {
          const event: events.ProposalEvent = await this._handle_proposal(state, pr);
          emit(event);
          if (event instanceof events.ProposalConfirmed) {
            state.proposals_confirmed += 1;
          }
        } catch (error) {
          emit(new events.ProposalFailed({ prop_id: pr.id(), reason: error }));
        } finally {
          csp.putAsync(chan_offer_tokens, true);
        }
      };
      handler(proposal);
      await promisify(csp.takeAsync)(chan_offer_tokens);
    }
  }

  async find_offers(state: SubmissionState, emit: Callable<[events.YaEvent], void>): Promise<void> {
    let keepSubscribing = true;
    while (keepSubscribing && !state.worker_cancellation_token.cancelled) {
      try {
        const subscription = await state.builder.subscribe(this._market_api);
        await asyncWith(subscription, async (subscription) => {
          try {
            await this.find_offers_for_subscription(state, subscription, emit);
          } catch (error) {
            logger.error(`Error while finding offers for a subscription: ${error}`);
            keepSubscribing = false;
          }
        });
      } catch (error) {
        emit(new events.SubscriptionFailed({ reason: error }));
        keepSubscribing = false;
      }
    }
    logger.debug("Stopped checking and scoring new offers.");
  }

  async *_submit(
    worker: Callable<[WorkContext, AsyncIterable<Task<D, R>>], AsyncGenerator<WorkItem, any, BatchResults>>,
    data: Iterable<Task<D, R>>
  ): AsyncGenerator<Task<D, R>> {
    const emit = this.emit;
    let multi_payment_decoration;
    try {
      multi_payment_decoration = await this._create_allocations();
    } catch (error) {
      if (error.response && error.response.status === 401) {
        throw new Error("Error: not authorized. Please check if YAGNA_APPKEY env variable is valid.");
      } else {
        throw error;
      }
    }

    emit(new events.ComputationStarted({ expires: this._expires }));
    // Building offer
    const builder = new DemandBuilder();
    const _activity = new Activity();
    _activity.expiration.value = this._expires;
    _activity.multi_activity.value = true;
    builder.add(_activity);
    builder.add(new NodeInfo(this._subnet));
    if (this._subnet) builder.ensure(`(${NodeInfoKeys.subnet_tag}=${this._subnet})`);
    for (const constraint of multi_payment_decoration.constraints) {
      builder.ensure(constraint);
    }
    for (const x of multi_payment_decoration.properties) {
      builder._properties[x.key] = x.value;
    }
    await this._task_package.decorate_demand(builder);
    await this._strategy.decorate_demand(builder);

    const agreements_pool = new AgreementsPool(emit);
    this.state = new SubmissionState(builder, agreements_pool);
    agreements_pool.cancellation_token = this.state.worker_cancellation_token;
    const market_api = this._market_api;
    const activity_api = this._activity_api;
    const strategy = this._strategy;
    const cancellationToken = this._cancellation_token;
    const paymentCancellationToken = this.state.payment_cancellation_token;
    const done_queue: Queue<Task<D, R>> = new Queue([]);
    const stream_output = this._stream_output;
    const workers_done = csp.chan();
    const network = this._network;

    function on_task_done(task: Task<D, R>, status: TaskStatus): void {
      if (status === TaskStatus.ACCEPTED) done_queue.put(task); //put_nowait
    }

    function* input_tasks(): Iterable<Task<D, R>> {
      for (const task of data) {
        task._add_callback(on_task_done);
        yield task;
      }
    }

    const work_queue = new SmartQueue([...input_tasks()]);

    let workers: Set<any> = new Set(); //asyncio.Task[]
    let last_wid = 0;
    const self = this;

    const agreements_to_pay: Set<string> = new Set();
    const agreements_accepting_debit_notes: Set<string> = new Set();
    const invoices: Map<string, Invoice> = new Map();
    let payment_closing = false;
    const secure = this._task_package.secure;

    async function process_invoices(): Promise<void> {
      for await (const invoice of self._payment_api.incoming_invoices(paymentCancellationToken)) {
        if (agreements_to_pay.has(invoice.agreementId)) {
          emit(
            new events.InvoiceReceived({
              agr_id: invoice.agreementId,
              inv_id: invoice.invoiceId,
              amount: invoice.amount,
            })
          );
          emit(new events.CheckingPayments());
          try {
            const allocation = self._get_allocation(invoice);
            await invoice.accept(invoice.amount, allocation);
            agreements_to_pay.delete(invoice.agreementId);
            agreements_accepting_debit_notes.delete(invoice.agreementId);
            emit(
              new events.PaymentAccepted({
                agr_id: invoice.agreementId,
                inv_id: invoice.invoiceId,
                amount: invoice.amount,
              })
            );
          } catch (e) {
            emit(
              new events.PaymentFailed({
                agr_id: invoice.agreementId,
                reason: `${e}: ${e.response && e.response.data ? e.response.data.message : ""}`,
              })
            );
          }
        } else {
          invoices.set(invoice.agreementId, invoice);
        }
        if (payment_closing && agreements_to_pay.size === 0) {
          break;
        }
      }
      if (!paymentCancellationToken.cancelled) {
        paymentCancellationToken.cancel();
      }
      logger.debug("Stopped processing invoices.");
    }

    async function accept_payment_for_agreement({ agreement_id, partial }): Promise<void> {
      emit(new events.PaymentPrepared({ agr_id: agreement_id }));
      const inv = invoices.get(agreement_id);
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
      for await (const debit_note of self._payment_api.incoming_debit_notes(paymentCancellationToken)) {
        if (agreements_accepting_debit_notes.has(debit_note.agreementId)) {
          emit(
            new events.DebitNoteReceived({
              agr_id: debit_note.agreementId,
              note_id: debit_note.debitNodeId,
              amount: debit_note.totalAmountDue,
            })
          );
          try {
            const allocation = self._get_allocation(debit_note);
            await debit_note.accept(debit_note.totalAmountDue, allocation);
          } catch (e) {
            emit(new events.PaymentFailed({ agr_id: debit_note.agreementId, reason: e.toString() }));
          }
        }
        if (payment_closing && agreements_to_pay.size === 0) {
          break;
        }
      }
      logger.debug("Stopped processing debit notes.");
    }

    const storage_manager = await this._stack.enter_async_context(gftp.provider());

    const unpack_work_item = (item: WorkItem): [Work, ExecOptions] => {
      return item instanceof Work ? [item, new ExecOptions()] : item;
    };

    async function process_batches(
      agreement_id: string,
      activity: rest.Activity,
      command_generator: AsyncGenerator<WorkItem, any>,
      consumer: Consumer<Task<D, R>>
    ): Promise<void> {
      /* TODO ctrl+c handling */
      let { done = false, value: item }: { done?: boolean; value: WorkItem } = await command_generator.next();
      while (!done) {
        const [batch, exec_options] = unpack_work_item(item);
        if (batch.timeout()) {
          if (exec_options.batch_timeout) {
            logger.warn("Overriding batch timeout set with commit({timeout:...}) by value from ExecOptions");
          } else {
            exec_options.batch_timeout = batch.timeout();
          }
        }
        let batch_deadline;
        if (exec_options.batch_timeout) {
          batch_deadline = (Date.now() + exec_options.batch_timeout) / 1000;
        }
        const current_worker_task = consumer.last_item();
        if (current_worker_task) {
          emit(
            new events.TaskStarted({
              agr_id: agreement_id,
              task_id: current_worker_task.id,
              task_data: current_worker_task.data(),
            })
          );
        }
        const task_id = current_worker_task ? current_worker_task.id : undefined;
        batch.attestation = {
          credentials: activity.credentials,
          nonce: activity.id,
          exeunitHashes: activity.exeunitHashes,
        };
        await batch.prepare();
        const cc = new CommandContainer();
        batch.register(cc);
        const remote = await activity.send(
          cc.commands(),
          stream_output,
          batch_deadline,
          (<SubmissionState>self.state).worker_cancellation_token
        );
        const cmds = cc.commands();
        emit(new events.ScriptSent({ agr_id: agreement_id, task_id, cmds }));
        const get_batch_results = async (): Promise<events.CommandEvent[]> => {
          const results: events.CommandEvent[] = [];
          for await (const evt_ctx of remote) {
            const evt = evt_ctx.event(agreement_id, task_id, cmds);
            emit(evt);
            results.push(evt);
            if (evt instanceof events.CommandExecuted && !evt.success) {
              throw new CommandExecutionError(evt.command, evt.message);
            }
          }
          emit(new events.GettingResults({ agr_id: agreement_id, task_id: task_id }));
          await batch.post();
          emit(new events.ScriptFinished({ agr_id: agreement_id, task_id: task_id }));
          await accept_payment_for_agreement({ agreement_id: agreement_id, partial: true });
          emit(new events.CheckingPayments());
          return results;
        };
        if (exec_options.wait_for_results) {
          // Block until the results are available
          let results: BatchResults | undefined;
          try {
            results = { results: await get_batch_results() };
          } catch (error) {
            // Raise the exception in `command_generator` (the `worker` coroutine).
            // If the client code is able to handle it then we'll proceed with
            // subsequent batches. Otherwise the worker finishes with error.
            ({ done = false, value: item } = await command_generator.throw(error));
          }
          if (results !== undefined) {
            ({ done = false, value: item } = await command_generator.next((async () => results)()));
          }
        } else {
          // Run without blocking
          const get_results = (async (): Promise<BatchResults> => {
            try {
              const results = await get_batch_results();
              return new Promise((resolve, _) => resolve({ results }));
            } catch (error) {
              logger.warn(`Error while getting batch results: ${error}`);
              return new Promise((resolve, _) => resolve({ error }));
            }
          })();
          ({ done = false, value: item } = await command_generator.next(get_results));
        }
      }
    }

    async function start_worker(agreement: Agreement): Promise<void> {
      const wid = last_wid;
      last_wid += 1;

      emit(new events.WorkerStarted({ agr_id: agreement.id() }));

      if ((<SubmissionState>self.state).worker_cancellation_token.cancelled) {
        return;
      }
      let _act: Activity;
      try {
        _act = await activity_api.new_activity(agreement, secure);
      } catch (error) {
        emit(new events.ActivityCreateFailed({ agr_id: agreement.id() }));
        emit(new events.WorkerFinished({ agr_id: agreement.id(), exception: error }));
        throw error;
      }

      async function* task_emitter(consumer: Consumer<any>): AsyncGenerator<Task<"TaskData", "TaskResult">> {
        for await (const handle of consumer) {
          if ((<SubmissionState>self.state).worker_cancellation_token.cancelled) {
            break;
          }
          yield Task.for_handle(handle, work_queue, emit);
        }
      }

      await asyncWith(_act, async (act): Promise<void> => {
        emit(new events.ActivityCreated({ act_id: act.id, agr_id: agreement.id() }));
        agreements_accepting_debit_notes.add(agreement.id());
        const agreement_details = await agreement.details();
        const node_info = <NodeInfo>agreement_details.provider_view().extract(new NodeInfo());
        const provider_name = node_info.name.value;
        const provider_id = agreement_details.raw_details.offer.providerId;
        let network_node;
        if (network) {
          network_node = await network.add_node(provider_id);
        }
        const work_context = new WorkContext(
          `worker-${wid}`,
          storage_manager,
          emit,
          { provider_id, provider_name },
          network_node
        );
        await asyncWith(work_queue.new_consumer(), async (consumer) => {
          try {
            const tasks = task_emitter(consumer);
            const batch_generator = worker(work_context, tasks);
            await process_batches(agreement.id(), act, batch_generator, consumer);
            emit(new events.WorkerFinished({ agr_id: agreement.id(), exception: undefined }));
          } catch (error) {
            emit(new events.WorkerFinished({ agr_id: agreement.id(), exception: error }));
            throw error;
          } finally {
            await accept_payment_for_agreement({ agreement_id: agreement.id(), partial: false });
          }
        });
        if ((<SubmissionState>self.state).worker_cancellation_token.cancelled) {
          return;
        }
        await accept_payment_for_agreement({ agreement_id: agreement.id(), partial: false });
        emit(new events.WorkerFinished({ agr_id: agreement.id(), exception: undefined }));
      });
      logger.debug(`Stopped worker related to agreement ${agreement.id()}.`);
    }

    async function worker_starter(): Promise<void> {
      async function _start_worker(agreement: Agreement): Promise<void> {
        try {
          await start_worker(agreement);
        } catch (error) {
          logger.warn(`Worker for agreement ${agreement.id()} finished with error: ${error}`);
          await agreements_pool.release_agreement(agreement.id(), false);
        } finally {
          csp.putAsync(workers_done, true);
        }
      }
      while (true) {
        await sleep(2);
        await agreements_pool.cycle();
        if ((<SubmissionState>self.state).worker_cancellation_token.cancelled) {
          break;
        }
        if (workers.size < self._conf.max_workers && work_queue.has_unassigned_items()) {
          let new_task: any;
          try {
            if ((<SubmissionState>self.state).worker_cancellation_token.cancelled) {
              break;
            }
            const { task: new_task } = await agreements_pool.use_agreement((agreement: Agreement, _: any) =>
              loop.create_task(_start_worker.bind(null, agreement))
            );
            if (new_task === undefined) {
              continue;
            }
            workers.add(new_task);
          } catch (error) {
            if (new_task) new_task.cancel();
            logger.debug(`There was a problem during use_agreement: ${error}.`);
          }
        }
      }
      logger.debug("Stopped starting new tasks on providers.");
    }

    async function promise_timeout(seconds: number) {
      return bluebird.coroutine(function* (): any {
        yield sleep(seconds);
      })();
    }

    const loop = eventLoop();
    const find_offers_task = loop.create_task(this.find_offers.bind(this, this.state, emit));
    const process_invoices_job = loop.create_task(process_invoices);
    const wait_until_done = loop.create_task(work_queue.wait_until_done.bind(work_queue));
    let get_offers_deadline = dayjs.utc() + this._conf.get_offers_timeout;
    let get_done_task: any = null;
    const worker_starter_task = loop.create_task(worker_starter);
    const debit_notes_job = loop.create_task(process_debit_notes);
    let services: any = [find_offers_task, worker_starter_task, process_invoices_job, wait_until_done, debit_notes_job];
    try {
      while (services.indexOf(wait_until_done) > -1 || !done_queue.empty()) {
        if (cancellationToken.cancelled) {
          work_queue.close();
          done_queue.close();
          break;
        }
        const now = dayjs.utc();
        if (now > this._expires) {
          throw new TimeoutError(`task timeout exceeded. timeout=${this._conf.timeout}`);
        }
        if (now > get_offers_deadline && this.state.proposals_confirmed == 0) {
          emit(
            new events.NoProposalsConfirmed({
              num_offers: this.state.offers_collected,
              timeout: this._conf.get_offers_timeout,
            })
          );
          get_offers_deadline += this._conf.get_offers_timeout;
        }

        if (!get_done_task) {
          get_done_task = loop.create_task(done_queue.get.bind(done_queue));
          services.push(get_done_task);
        }

        await bluebird.Promise.any([...services, ...workers, promise_timeout(10)]);

        workers = new Set([...workers].filter((worker) => worker.isPending()));
        services = services.filter((service) => service.isPending());

        if (!get_done_task) throw "";
        if (!get_done_task.isPending()) {
          const res = await get_done_task;
          if (res) {
            yield res;
          } else {
            break;
          }
          if (services.indexOf(get_done_task) > -1) throw "";
          get_done_task = null;
        }
      }
      emit(new events.ComputationFinished());
    } catch (error) {
      if (error instanceof AsyncGeneratorBreak) {
        work_queue.close();
        done_queue.close();
        logger.info("Break in the async for loop. Gracefully stopping all computations.");
      } else {
        logger.error(`Computation Failed. Error: ${error}`);
      }
      // TODO: implement ComputationFinished(error)
      emit(new events.ComputationFinished());
    } finally {
      if (cancellationToken.cancelled) {
        logger.error("Computation interrupted by the user.");
      }
      payment_closing = true;
      if (!(<SubmissionState>self.state).worker_cancellation_token.cancelled)
        (<SubmissionState>self.state).worker_cancellation_token.cancel();
      try {
        if (workers.size > 0) {
          emit(new events.CheckingPayments());
          logger.debug(`Waiting for ${workers.size} workers to stop...`);
          for (let i = workers.size; i > 0; --i) {
            await promisify(csp.takeAsync)(workers_done);
            logger.debug(`Waiting for workers to stop: ${workers.size - i + 1}/${workers.size} done.`);
          }
          emit(new events.CheckingPayments());
        }
      } catch (error) {
        logger.error(`Error while waiting for workers to finish: ${error}.`);
      }
      try {
        await agreements_pool.cycle();
        await agreements_pool.terminate_all({
          message: cancellationToken.cancelled ? "Work cancelled" : "Successfully finished all work",
          "golem.requestor.code": cancellationToken.cancelled ? "Cancelled" : "Success",
        });
      } catch (error) {
        logger.debug(`Problem with agreements termination ${error}`);
      }
      if (agreements_to_pay.size > 0) {
        logger.debug(`Waiting for ${agreements_to_pay.size} invoices...`);
      }
      try {
        await bluebird.Promise.all([process_invoices_job, debit_notes_job]).timeout(25000);
      } catch (error) {
        logger.warn(`Error while waiting for invoices: ${error}.`);
      }
      emit(new events.CheckingPayments());
      if (agreements_to_pay.size > 0) {
        logger.warn(`${agreements_to_pay.size} unpaid invoices ${Array.from(agreements_to_pay.keys()).join(",")}.`);
      }
      if (!paymentCancellationToken.cancelled) {
        paymentCancellationToken.cancel();
      }
      emit(new events.PaymentsFinished());
      await sleep(1);
      logger.info("Shutdown complete.");
    }
    return;
  }

  async _create_allocations(): Promise<MarketDecoration> {
    if (!this._budget_allocations.length) {
      for await (const account of this._payment_api.accounts()) {
        const driver = account.driver ? account.driver.toLowerCase() : "";
        const network = account.driver ? account.network.toLowerCase() : "";
        if (driver != this._payment_driver || network != this._payment_network) {
          logger.debug(
            `Not using payment platform ${account.platform}, platform's driver/network ` +
              `${driver}/${network} is different than requested ` +
              `driver/network ${this._payment_driver}/${this._payment_network}`
          );
          continue;
        }
        logger.debug(`Creating allocation using payment platform ${account.platform}`);
        const allocation: Allocation = await this._stack.enter_async_context(
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
        throw new NoPaymentAccountError(this._payment_driver, this._payment_network);
      }
    }
    const allocation_ids = this._budget_allocations.map((a) => a.id);
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
    const req_platforms = this._budget_allocations.map((budget_allocation) => budget_allocation.payment_platform);
    return req_platforms.filter((value) => value && prov_platforms.includes(value)) as string[];
  }

  _get_allocation(item: Invoice | DebitNote): Allocation {
    try {
      const _allocation = this._budget_allocations.find(
        (allocation) =>
          allocation.payment_platform === item.paymentPlatform && allocation.payment_address === item.payerAddr
      );
      if (_allocation) return _allocation;
      throw `No allocation for ${item.paymentPlatform} ${item.payerAddr}.`;
    } catch (error) {
      throw new Error(error);
    }
  }

  async ready(): Promise<Executor> {
    const stack = this._stack;
    // TODO: Cleanup on exception here.
    this._expires = dayjs.utc().add(this._conf.timeout, "ms");
    const market_client = await this._api_config.market();
    this._market_api = new rest.Market(market_client);

    const activity_client = await this._api_config.activity();
    this._activity_api = new ActivityService(activity_client);

    const payment_client = await this._api_config.payment();
    this._payment_api = new rest.Payment(payment_client);

    const net_client = await this._api_config.net();
    this._net_api = new rest.Net(net_client);

    await stack.enter_async_context(this._wrapped_consumer);

    if (this._network_address) {
      // TODO: replace with a proper REST API client once ya-client and ya-ts-client are updated
      // https://github.com/golemfactory/yajsapi/issues/290
      const {
        data: { identity },
      } = await axios.get(this._api_config.__url + "/me", {
        headers: { authorization: `Bearer ${net_client.accessToken}` },
      });
      this._network = await Network.create(this._net_api, this._network_address, identity);
    }

    return this;
  }

  // cleanup, if needed
  async done(this): Promise<void> {
    logger.debug("Executor is shutting down...");
    while (this._active_computations > 0) {
      logger.debug(`Waiting for ${this._active_computations} computation(s)...`);
      await promisify(csp.takeAsync)(this._chan_computation_done);
      this._active_computations -= 1;
    }
    this._cancellation_token.cancel();
    // TODO: prevent new computations at this point (if it's even possible to start one)
    this._market_api = null;
    this._payment_api = null;
    if (this._network) await this._network.remove();
    this._net_api = null;
    this.emit(new events.ShutdownFinished());
    try {
      await this._stack.aclose();
      logger.info("Executor has shut down");
    } catch (e) {
      logger.error(`Error when shutting down Executor: ${e}`);
    } finally {
      this._event_consumer_cancellation_token.cancel();
    }
  }
}
