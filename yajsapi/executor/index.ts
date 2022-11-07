/* eslint @typescript-eslint/no-this-alias: 0 */
/* eslint no-constant-condition: 0 */
/* old executor */
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import duration from "dayjs/plugin/duration";
import { MarketDecoration } from "ya-ts-client/dist/ya-payment/src/models";

import * as events from "./events";
import { Activity as ActivityProp, NodeInfo, NodeInfoKeys, DemandBuilder } from "../props";
import { Counter } from "../props/com";
import { Network } from "../network";

import * as rest from "../rest";
import { OfferProposal, Subscription } from "../rest/market";
import { AgreementsPool } from "../market/agreements_pool_service";
import { Allocation, DebitNote, Invoice } from "../rest/payment";
import { Activity, ActivityFactory } from "../activity";

import {
  AsyncExitStack,
  asyncWith,
  AsyncWrapper,
  Callable,
  CancellationToken,
  eventLoop,
  logSummary,
  sleep,
  Logger,
  winstonLogger,
  runtimeContextChecker,
} from "../utils";

import {
  DecreaseScoreForUnconfirmedAgreement,
  LeastExpensiveLinearPayuMS,
  MarketStrategy,
  SCORE_NEUTRAL,
} from "./strategy";
import { Package } from "../package";
import axios from "axios";

import { Worker } from "./executor";
import { Task } from "./task_new";
import { EventBus } from "./event_bus";
import { TaskQueue } from "./task_queue";
import { TaskService } from "./task_service";
import { PaymentService } from "../payment/payment_service";
import { NetworkService } from "../network/network_service";

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

export class CommandExecutionError extends Error {
  command: string;
  message: string;
  constructor(command: string, message?: string) {
    super(message);
    this.command = command;
    this.message = message || "";
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

type D = "D"; // Type var for task data
type R = "R"; // Type var for task result

export type ExecutorOpts = {
  task_package: Package;
  max_workers?: number;
  timeout?: number | string; //timedelta
  budget?: string; //number?
  strategy?: MarketStrategy;
  subnet_tag?: string;
  driver?: string; // @deprecated
  network?: string; // @deprecated
  payment_driver?: string;
  payment_network?: string;
  event_consumer?: Callable<[events.YaEvent], void>; //TODO not default event
  network_address?: string;
  logger?: Logger;
  logLevel?: string;
  credentials?: { apiKey?: string; apiUrl?: string };
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
  // private work_queue?: SmartQueue<Task<D, R>>;
  // private done_queue?: Queue<Task<D, R>>;
  private isFinished = false;
  private isRunning = false;
  private agreements_to_pay = new Set<string>();
  private activities = new Map<string, Activity>();
  private initWorker?: Worker<undefined, unknown>;
  private logger?: Logger;
  private taskQueue = new TaskQueue<Task<any, any>>();
  private eventBus = new EventBus();
  private networkService?: NetworkService;

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
   * @param logger          optional custom logger
   * @param logLevel        optional log level for default logger
   * @param credentials     optional params to set Yagna app key and base URL
   * @param credentials.apiKey env variable equivalent: YAGNA_APPKEY
   * @param credentials.apiUrl env variable equivalent: YAGNA_API_URL
   */
  constructor({
    task_package,
    max_workers = 5,
    timeout = DEFAULT_EXECUTOR_TIMEOUT,
    budget = "1.0",
    strategy,
    subnet_tag,
    driver,
    network,
    payment_driver,
    payment_network,
    event_consumer,
    network_address,
    logger,
    logLevel,
    credentials,
  }: ExecutorOpts) {
    this.logger = logger;
    if (!logger && !runtimeContextChecker.isBrowser) this.logger = winstonLogger;
    this.logger?.setLevel && this.logger?.setLevel(logLevel || "info");
    this._subnet = subnet_tag ? subnet_tag : DEFAULT_SUBNET;
    this._payment_driver = payment_driver ? payment_driver.toLowerCase() : DEFAULT_DRIVER;
    this._payment_network = payment_network ? payment_network.toLowerCase() : DEFAULT_NETWORK;
    if (driver) {
      this.logger?.warn(
        `The 'driver' parameter is deprecated. It will be removed in a future release. Use 'payment_driver' instead.`
      );
      this._payment_driver = driver.toLowerCase();
    }
    if (network) {
      this.logger?.warn(
        `The 'network' parameter is deprecated. It will be removed in a future release. Use 'payment_network' instead.`
      );
      this._payment_network = network.toLowerCase();
    }
    this.logger?.info(
      `Using subnet: ${this._subnet}, network: ${this._payment_network}, driver: ${this._payment_driver}`
    );
    this._stream_output = false;
    this._api_config = new rest.Configuration(credentials?.apiKey, credentials?.apiUrl);
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
          ]),
          this.logger
        ),
        0.5,
        this.logger
      );
    this._budget_allocations = [];

    this._cancellation_token = new CancellationToken();
    const cancellationToken = this._cancellation_token;

    function cancel(event) {
      if (cancellationToken && !cancellationToken.cancelled) {
        cancellationToken.cancel();
      }
      SIGNALS.forEach((event) => {
        process?.off(event, cancel);
      });
    }
    SIGNALS.forEach((event) => process?.on(event, cancel));

    if (!event_consumer && this.logger) {
      event_consumer = logSummary(this.logger);
    }
    this._event_consumer_cancellation_token = new CancellationToken();
    this._wrapped_consumer =
      event_consumer && new AsyncWrapper(event_consumer, null, this._event_consumer_cancellation_token);
    // this.emit = <Callable<[events.YaEvent], void>>this._wrapped_consumer.async_call.bind(this._wrapped_consumer);
    // this.emit = () => null;
    this.emit = event_consumer;
    this._network_address = network_address;
  }

  submit_init_worker(worker) {
    this.initWorker = worker;
  }

  async _handle_proposal(state: SubmissionState, proposal: OfferProposal): Promise<events.ProposalEvent> {
    const reject_proposal = async (reason: string): Promise<events.ProposalEvent> => {
      await proposal.reject(reason);
      return new events.ProposalRejected({ prop_id: proposal.id(), reason: reason });
    };
    let score;
    try {
      score = await this._strategy.score_offer(proposal, state.agreements_pool);
      this.logger?.debug(
        `Scored offer ${proposal.id()}, ` +
          `provider: ${proposal.props()["golem.node.id.name"]}, ` +
          `strategy: ${this._strategy.constructor.name}, ` +
          `score: ${score}`
      );
    } catch (error) {
      this.logger?.debug(`Score offer error: ${error}`);
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
      await state.agreements_pool.addProposal(score, proposal);
      return new events.ProposalConfirmed({ prop_id: proposal.id() });
    }
  }

  async find_offers_for_subscription(
    state: SubmissionState,
    subscription: Subscription,
    emit: Callable<[events.YaEvent], void>
  ): Promise<void> {
    emit(new events.SubscriptionCreated({ sub_id: subscription.id() }));
    // const chan_offer_tokens = csp.chan();
    // const max_number_of_tasks = 5;
    // for (let i = 0; i < max_number_of_tasks; ++i) {
    //   csp.putAsync(chan_offer_tokens, true);
    // }
    const chan_offer_tokens: boolean[] = [];
    const max_number_of_tasks = 5;
    for (let i = 0; i < max_number_of_tasks; ++i) {
      chan_offer_tokens.push(true);
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
          chan_offer_tokens.push(true);
          // csp.putAsync(chan_offer_tokens, true);
        }
      };
      handler(proposal);

      // eslint-disable-next-line no-async-promise-executor
      await new Promise(async (res, rej) => {
        setTimeout(() => rej(), 30000);
        while (!chan_offer_tokens.length) await sleep(2);
        chan_offer_tokens.pop();
        res(true);
      });
      // await promisify(csp.takeAsync)(chan_offer_tokens);
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
            this.logger?.error(`Error while finding offers for a subscription: ${error}`);
            keepSubscribing = false;
          }
        });
      } catch (error) {
        emit(new events.SubscriptionFailed({ reason: error }));
        keepSubscribing = false;
      }
    }
    this.logger?.debug("Stopped checking and scoring new offers.");
  }

  async init() {
    const emit = this.emit;
    let multi_payment_decoration;
    try {
      multi_payment_decoration = await this._create_allocations();
    } catch (error) {
      if (error.response && error.response.status === 401) {
        throw new Error("Error: not authorized. Please check if YAGNA_APPKEY env variable is valid.");
      } else {
        console.log({ error });
        throw error;
      }
    }

    emit(new events.ComputationStarted({ expires: this._expires }));
    // Building offer
    const builder = new DemandBuilder();
    const _activity = new ActivityProp();
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

    const agreementsPool = new AgreementsPool(emit, this.logger);
    this.state = new SubmissionState(builder, agreementsPool);
    // agreements_pool.cancellation_token = this.state.worker_cancellation_token;
    const activity_api = this._activity_api;
    const cancellationToken = this._cancellation_token;
    const paymentCancellationToken = this.state.payment_cancellation_token;
    const network = this._network;
    const self = this;

    const agreements_to_pay = this.agreements_to_pay;
    const agreements_accepting_debit_notes: Set<string> = new Set();
    const invoices: Map<string, Invoice> = new Map();
    let payment_closing = false;
    const logger = this.logger;
    const gftp = runtimeContextChecker.isNode ? await import("../storage/gftp") : null;

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
      logger?.debug("Stopped processing invoices.");
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
      logger?.debug("Stopped processing debit notes.");
    }

    const storageProvider = runtimeContextChecker.isNode ? gftp?.provider() : null;

    if (this._network_address) {
      const net_client = await this._api_config.net();
      // TODO: replace with a proper REST API client once ya-client and ya-ts-client are updated
      // https://github.com/golemfactory/yajsapi/issues/290
      const {
        data: { identity },
      } = await axios.get(this._api_config.__url + "/me", {
        headers: { authorization: `Bearer ${net_client.accessToken}` },
      });
      this._network = await Network.create(this._net_api, this._network_address, identity, this.logger);
      this.networkService = new NetworkService(
        {
          api: this._net_api,
          address: this._network_address,
          identity,
        },
        this.eventBus,
        this.logger
      );
    }

    const process_invoices_job = loop.create_task(process_invoices);
    const debit_notes_job = loop.create_task(process_debit_notes);
    let get_offers_deadline = dayjs.utc() + this._conf.get_offers_timeout;

    const paymentService = new PaymentService(self.eventBus, logger);
    paymentService["accept_payment_for_agreement"] = accept_payment_for_agreement;

    self.isRunning = true;
    const taskService = new TaskService(
      self._api_config.app_key(),
      self.isRunning,
      self.taskQueue,
      agreementsPool,
      paymentService,
      self.eventBus,
      storageProvider,
      self.networkService,
      logger
    );

    try {
      this.find_offers(this.state, emit);
      paymentService.run();
      taskService.run();
      while (this.isRunning) {
        const now = dayjs.utc();
        if (now > this._expires) {
          throw new Error(`Task timeout exceeded. timeout=${this._conf.timeout}`);
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
      }
      emit(new events.ComputationFinished());
    } catch (error) {
      if (error instanceof AsyncGeneratorBreak) {
        this.isRunning = false;
        this.logger?.info("Break in the async for loop. Gracefully stopping all computations.");
      } else {
        this.logger?.error(`Computation Failed. Error: ${error}`);
      }
      emit(new events.ComputationFinished());
    } finally {
      if (cancellationToken.cancelled) {
        this.logger?.error("Computation interrupted by the user.");
      }
      payment_closing = true;
      if (!(<SubmissionState>self.state).worker_cancellation_token.cancelled)
        (<SubmissionState>self.state).worker_cancellation_token.cancel();
      try {
        if (this.taskQueue.size() > 0) {
          emit(new events.CheckingPayments());
          this.logger?.debug(`Waiting for ${this.taskQueue.size()} workers to stop...`);
        }
      } catch (error) {
        this.logger?.error(`Error while waiting for workers to finish: ${error}.`);
      }
      try {
        await agreementsPool.terminateAll({
          message: cancellationToken.cancelled ? "Work cancelled" : "Successfully finished all work",
          "golem.requestor.code": cancellationToken.cancelled ? "Cancelled" : "Success",
        });
      } catch (error) {
        this.logger?.debug(`Problem with agreements termination ${error}`);
      }
      if (agreements_to_pay.size > 0) {
        this.logger?.debug(`Waiting for ${agreements_to_pay.size} invoices...`);
      }
      try {
        await Promise.all([process_invoices_job, debit_notes_job]);
      } catch (error) {
        this.logger?.warn(`Error while waiting for invoices: ${error}.`);
      }
      emit(new events.CheckingPayments());
      if (agreements_to_pay.size > 0) {
        this.logger?.warn(
          `${agreements_to_pay.size} unpaid invoices ${Array.from(agreements_to_pay.keys()).join(",")}.`
        );
      }
      if (!paymentCancellationToken.cancelled) {
        paymentCancellationToken.cancel();
      }
      emit(new events.PaymentsFinished());
      await sleep(1);
    }
  }

  async submit_new_task<InputType, OutputType>(
    worker: Worker<InputType, OutputType>,
    data?: InputType
  ): Promise<OutputType | undefined> {
    const task = new Task<InputType, OutputType>(worker, data, this.initWorker);
    this.taskQueue.addToEnd(task);
    let timeout = false;
    setTimeout(() => (timeout = true), 20000);
    while (!timeout) {
      if (task.isFinished()) return task.getResults();
      await sleep(2);
    }
  }

  async _create_allocations(): Promise<MarketDecoration> {
    if (!this._budget_allocations.length) {
      for await (const account of this._payment_api.accounts()) {
        const driver = account.driver ? account.driver.toLowerCase() : "";
        const network = account.driver ? account.network.toLowerCase() : "";
        if (driver != this._payment_driver || network != this._payment_network) {
          this.logger?.debug(
            `Not using payment platform ${account.platform}, platform's driver/network ` +
              `${driver}/${network} is different than requested ` +
              `driver/network ${this._payment_driver}/${this._payment_network}`
          );
          continue;
        }
        this.logger?.debug(`Creating allocation using payment platform ${account.platform}`);
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

    const activity_config = await this._api_config.activity();
    this._activity_api = new ActivityFactory(activity_config.apiKey, activity_config.basePath);

    const payment_client = await this._api_config.payment();
    this._payment_api = new rest.Payment(payment_client, this.logger);

    const net_client = await this._api_config.net();
    this._net_api = new rest.Net(net_client);

    await stack.enter_async_context(this._wrapped_consumer);

    return this;
  }

  // cleanup, if needed
  async done(this): Promise<void> {
    this.isFinished = true;
    this.logger?.debug("Executor is shutting down...");
    while (this._active_computations > 0) {
      this.logger?.debug(`Waiting for ${this._active_computations} computation(s)...`);
      this._active_computations -= 1;
    }
    let timeout = false;
    setTimeout(() => (timeout = true), 10000);
    while (this.agreements_to_pay.size > 0 && !timeout) {
      this.logger?.debug(`Waiting for ${this.agreements_to_pay.size} payment(s)...`);
      await sleep(4);
    }
    await sleep(5);
    this._cancellation_token.cancel();
    // TODO: prevent new computations at this point (if it's even possible to start one)
    this._market_api = null;
    this._payment_api = null;
    if (this._network) await this._network.remove();
    this._net_api = null;
    this.emit(new events.ShutdownFinished());
    try {
      await this._stack.aclose();
      this.logger?.info("Executor has shut down");
    } catch (e) {
      this.logger?.error(`Error when shutting down Executor: ${e}`);
    } finally {
      this._event_consumer_cancellation_token.cancel();
    }
  }

  async run(runner) {
    const executor = await this.ready();
    let errorInRunner;
    try {
      await runner(executor);
    } catch (error) {
      errorInRunner = error;
    }
    await this.done();
    if (errorInRunner) {
      throw errorInRunner;
    }
  }
}
