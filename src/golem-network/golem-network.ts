import { defaultLogger, isNode, Logger, YagnaApi } from "../shared/utils";
import {
  Demand,
  DraftOfferProposalPool,
  IMarketApi,
  MarketModule,
  MarketModuleImpl,
  MarketOptions,
  OfferProposal,
} from "../market";
import { Allocation, IPaymentApi, PaymentModule, PaymentModuleImpl, PaymentModuleOptions } from "../payment";
import { ActivityModule, ActivityModuleImpl, ExeUnitOptions, IActivityApi, IFileServer } from "../activity";
import { INetworkApi, Network, NetworkModule, NetworkModuleImpl, NetworkOptions } from "../network";
import { EventEmitter } from "eventemitter3";
import {
  Concurrency,
  LeaseModule,
  LeaseModuleImpl,
  LeaseProcess,
  LeaseProcessOptions,
  LeaseProcessPool,
} from "../lease-process";
import { DebitNoteRepository, InvoiceRepository, MarketApiAdapter, PaymentApiAdapter } from "../shared/yagna";
import { ActivityApiAdapter } from "../shared/yagna/adapters/activity-api-adapter";
import { ActivityRepository } from "../shared/yagna/repository/activity-repository";
import { AgreementRepository } from "../shared/yagna/repository/agreement-repository";
import { ProposalRepository } from "../shared/yagna/repository/proposal-repository";
import { CacheService } from "../shared/cache/CacheService";
import { DemandRepository } from "../shared/yagna/repository/demand-repository";
import { BuildDemandOptions, IDemandRepository } from "../market/demand/demand";
import { GftpServerAdapter } from "../shared/storage/GftpServerAdapter";
import {
  GftpStorageProvider,
  NullStorageProvider,
  StorageProvider,
  WebSocketBrowserStorageProvider,
} from "../shared/storage";
import { DataTransferProtocol } from "../shared/types";
import { NetworkApiAdapter } from "../shared/yagna/adapters/network-api-adapter";
import { IProposalRepository } from "../market/proposal";

/**
 * Instance of an object or a factory function that you can call `new` on.
 * Optionally you can provide constructor arguments.
 */
export type InstanceOrFactory<TargetInterface, ConstructorArgs extends unknown[] = never[]> =
  | TargetInterface
  | { new (...args: ConstructorArgs): TargetInterface };

/**
 * If no override is provided, return a function that creates a new instance of the default factory.
 * If override is a factory, return a function that creates a new instance of that factory.
 * If override is an instance, return a function that returns that instance (ignoring the arguments).
 */
function getFactory<
  DefaultFactoryConstructorArgs extends unknown[],
  InstanceType extends object,
  FactoryType extends { new (...args: DefaultFactoryConstructorArgs): InstanceType },
>(
  defaultFactory: FactoryType,
  override: InstanceOrFactory<InstanceType, DefaultFactoryConstructorArgs> | undefined,
): (...args: ConstructorParameters<FactoryType>) => InstanceType {
  if (override) {
    if (typeof override === "function") {
      return (...args) => new override(...args);
    }
    return () => override;
  }
  return (...args) => new defaultFactory(...args);
}

export interface GolemNetworkOptions {
  /**
   * Logger instance to use for logging.
   * If no logger is provided you can view debug logs by setting the
   * `DEBUG` environment variable to `golem-js:*`.
   */
  logger?: Logger;
  /**
   * Set the API key and URL for the Yagna API.
   */
  api?: {
    key?: string;
    url?: string;
  };
  /**
   * Set payment-related options.
   * This is where you can specify the network, payment driver and more.
   * By default, the network is set to the `holesky` test network.
   */
  payment?: Partial<PaymentModuleOptions>;
  /**
   * Set the data transfer protocol to use for file transfers.
   * Default is `gftp`.
   */
  dataTransferProtocol?: DataTransferProtocol;
  /**
   * Override some of the services used by the GolemNetwork instance.
   * This is useful for testing or when you want to provide your own implementation of some services.
   * Only set this if you know what you are doing.
   * To override a module you can pass either an instance of an object or a factory function (that we can call `new` on).
   */
  override?: Partial<
    GolemServices & {
      market: InstanceOrFactory<MarketModule>;
      payment: InstanceOrFactory<PaymentModule>;
      activity: InstanceOrFactory<ActivityModule>;
      network: InstanceOrFactory<NetworkModule>;
      lease: InstanceOrFactory<LeaseModule>;
    }
  >;
}

type AllocationOptions = {
  /**
   * Optionally pass an existing allocation to use or an ID of an allocation that already exists in yagna.
   * If this is not provided, a new allocation will be created based on an estimated budget.
   */
  allocation?: Allocation | string;
};

/**
 * Represents the order specifications which will result in access to LeaseProcess.
 */
export interface MarketOrderSpec {
  demand: BuildDemandOptions;
  market: MarketOptions;
  activity?: LeaseProcessOptions["activity"];
  payment?: LeaseProcessOptions["payment"] & AllocationOptions;
  network?: Network;
}

export interface GolemNetworkEvents {
  /** Fires when all startup operations related to GN are completed */
  connected: () => void;

  /** Fires when an error will be encountered */
  error: (err: Error) => void;

  /** Fires when all shutdown operations related to GN are completed */
  disconnected: () => void;
}

export interface OneOfOptions {
  order: MarketOrderSpec;
  signalOrTimeout?: number | AbortSignal;
  setup?: ExeUnitOptions["setup"];
  teardown?: ExeUnitOptions["teardown"];
}

export interface ManyOfOptions {
  order: MarketOrderSpec;
  concurrency: Concurrency;
  setup?: ExeUnitOptions["setup"];
  teardown?: ExeUnitOptions["teardown"];
}

/**
 * Dependency Container
 */
export type GolemServices = {
  yagna: YagnaApi;
  logger: Logger;
  paymentApi: IPaymentApi;
  activityApi: IActivityApi;
  marketApi: IMarketApi;
  networkApi: INetworkApi;
  proposalCache: CacheService<OfferProposal>;
  proposalRepository: IProposalRepository;
  demandRepository: IDemandRepository;
  fileServer: IFileServer;
  storageProvider: StorageProvider;
};

/**
 * General purpose and high-level API for the Golem Network
 *
 * This class is the main entry-point for developers that would like to build on Golem Network
 * using `@golem-sdk/golem-js`. It is supposed to provide an easy access API for use 80% of use cases.
 */
export class GolemNetwork {
  public readonly events = new EventEmitter<GolemNetworkEvents>();

  public readonly options: GolemNetworkOptions;

  private readonly logger: Logger;

  private readonly yagna: YagnaApi;

  public readonly market: MarketModule;
  public readonly payment: PaymentModule;
  public readonly activity: ActivityModule;
  public readonly network: NetworkModule;
  public readonly lease: LeaseModule;

  /**
   * Dependency Container
   */
  public readonly services: GolemServices;

  private hasConnection = false;

  private readonly storageProvider: StorageProvider;

  /**
   * List af additional tasks that should be executed when the network is being shut down
   * (for example finalizing lease processes created with `oneOf`)
   */
  private readonly cleanupTasks: (() => Promise<void> | void)[] = [];

  constructor(options: Partial<GolemNetworkOptions> = {}) {
    const optDefaults: GolemNetworkOptions = {
      dataTransferProtocol: isNode ? "gftp" : "ws",
    };

    this.options = {
      ...optDefaults,
      ...options,
    };

    this.logger = options.logger ?? defaultLogger("golem-network");

    this.logger.debug("Creating Golem Network instance with options", { options: this.options });

    try {
      this.yagna =
        options.override?.yagna ||
        new YagnaApi({
          logger: this.logger,
          apiKey: this.options.api?.key,
          basePath: this.options.api?.url,
        });

      this.storageProvider = options.override?.storageProvider || this.createStorageProvider();

      const demandCache = new CacheService<Demand>();
      const proposalCache = new CacheService<OfferProposal>();

      const demandRepository = new DemandRepository(this.yagna.market, demandCache);
      const proposalRepository = new ProposalRepository(this.yagna.market, this.yagna.identity, proposalCache);
      const agreementRepository = new AgreementRepository(this.yagna.market, demandRepository);

      this.services = {
        logger: this.logger,
        yagna: this.yagna,
        storageProvider: this.storageProvider,
        demandRepository,
        proposalCache,
        proposalRepository,
        paymentApi:
          this.options.override?.paymentApi ||
          new PaymentApiAdapter(
            this.yagna,
            new InvoiceRepository(this.yagna.payment, this.yagna.market),
            new DebitNoteRepository(this.yagna.payment, this.yagna.market),
            this.logger,
          ),
        activityApi:
          this.options.override?.activityApi ||
          new ActivityApiAdapter(
            this.yagna.activity.state,
            this.yagna.activity.control,
            this.yagna.activity.exec,
            new ActivityRepository(this.yagna.activity.state, agreementRepository),
          ),
        marketApi:
          this.options.override?.marketApi ||
          new MarketApiAdapter(this.yagna, agreementRepository, proposalRepository, demandRepository, this.logger),
        networkApi: this.options.override?.networkApi || new NetworkApiAdapter(this.yagna),
        fileServer: this.options.override?.fileServer || new GftpServerAdapter(this.storageProvider),
      };
      this.network = getFactory(NetworkModuleImpl, this.options.override?.network)(this.services);
      this.market = getFactory(
        MarketModuleImpl,
        this.options.override?.market,
      )({
        ...this.services,
        networkModule: this.network,
      });
      this.payment = getFactory(PaymentModuleImpl, this.options.override?.payment)(this.services, this.options.payment);
      this.activity = getFactory(ActivityModuleImpl, this.options.override?.activity)(this.services);
      this.lease = getFactory(
        LeaseModuleImpl,
        this.options.override?.lease,
      )({
        activityModule: this.activity,
        paymentModule: this.payment,
        marketModule: this.market,
        networkModule: this.network,
        logger: this.logger,
        storageProvider: this.storageProvider,
      });
    } catch (err) {
      this.events.emit("error", err);
      throw err;
    }
  }

  /**
   * "Connects" to the network by initializing the underlying components required to perform operations on Golem Network
   *
   * @return Resolves when all initialization steps are completed
   */
  async connect() {
    try {
      await this.yagna.connect();
      await this.services.paymentApi.connect();
      await this.storageProvider.init();
      this.events.emit("connected");
      this.hasConnection = true;
    } catch (err) {
      this.events.emit("error", err);
      throw err;
    }
  }

  /**
   * "Disconnects" from the Golem Network
   *
   * @return Resolves when all shutdown steps are completed
   */
  async disconnect() {
    await Promise.allSettled(this.cleanupTasks.map((task) => task()));
    await this.storageProvider.close();
    await this.services.paymentApi.disconnect();
    await this.yagna.disconnect();

    this.services.proposalCache.flushAll();

    this.events.emit("disconnected");
    this.hasConnection = false;
  }

  private async getAllocationFromOrder({
    order,
    concurrency,
  }: {
    order: MarketOrderSpec;
    concurrency: Concurrency;
  }): Promise<Allocation> {
    if (!order.payment?.allocation) {
      const budget = this.market.estimateBudget({ order, concurrency });
      return this.payment.createAllocation({
        budget,
        expirationSec: order.market.rentHours * 60 * 60,
      });
    }
    if (typeof order.payment.allocation === "string") {
      return this.payment.getAllocation(order.payment.allocation);
    }
    return order.payment.allocation;
  }

  /**
   * Define your computational resource demand and access a single instance
   *
   * Use Case: Get a single instance of a resource from the market to execute operations on
   *
   * @example
   * ```ts
   * const lease = await glm.oneOf(demand);
   * await lease
   *  .getExeUnit()
   *  .then((exe) => exe.run("echo Hello, Golem! 👋"))
   *  .then((res) => console.log(res.stdout));
   * await lease.finalize();
   * ```
   *
   * @param options  timeout in milliseconds or an AbortSignal that will be used to cancel the lease request
   */
  async oneOf({ order, setup, teardown, signalOrTimeout }: OneOfOptions): Promise<LeaseProcess> {
    const proposalPool = new DraftOfferProposalPool({
      logger: this.logger,
      validateProposal: order.market.proposalFilter,
      selectProposal: order.market.proposalSelector,
    });

    const allocation = await this.getAllocationFromOrder({ order, concurrency: 1 });
    const demandSpecification = await this.market.buildDemandDetails(order.demand, allocation);

    const draftProposal$ = this.market.collectDraftOfferProposals({
      demandSpecification,
      pricing: order.market.pricing,
      filter: order.market.proposalFilter,
    });

    const proposalSubscription = proposalPool.readFrom(draftProposal$);

    const agreement = await this.market.signAgreementFromPool(
      proposalPool,
      {
        expirationSec: order.market.rentHours * 60 * 60,
      },
      signalOrTimeout,
    );

    const networkNode = order.network
      ? await this.network.createNetworkNode(order.network, agreement.provider.id)
      : undefined;

    const lease = this.lease.createLease(agreement, allocation, {
      payment: order.payment,
      activity: order.activity,
      networkNode,
      exeUnit: { setup, teardown },
    });

    // We managed to create the activity, no need to look for more agreement candidates
    proposalSubscription.unsubscribe();

    this.cleanupTasks.push(async () => {
      // First finalize the lease (which will wait for all payments to be processed)
      // and only then release the allocation
      await lease.finalize().catch((err) => this.logger.error("Error while finalizing lease", err));
      if (order.network && networkNode) {
        await this.network
          .removeNetworkNode(order.network, networkNode)
          .catch((err) => this.logger.error("Error while removing network node", err));
      }
      // Don't release the allocation if it was provided by the user
      if (order.payment?.allocation) {
        return;
      }
      await this.payment
        .releaseAllocation(allocation)
        .catch((err) => this.logger.error("Error while releasing allocation", err));
    });

    return lease;
  }

  /**
   * Define your computational resource demand and access a pool of instances.
   * The pool will grow up to the specified concurrency level.
   *
   * @example
   * ```ts
   * // create a pool that can grow up to 3 leases at the same time
   * const pool = await glm.manyOf({
   *   concurrency: 3,
   *   demand
   * });
   * await Promise.allSettled([
   *   pool.withLease(async (lease) =>
   *     lease
   *       .getExeUnit()
   *       .then((exe) => exe.run("echo Hello, Golem from the first machine! 👋"))
   *       .then((res) => console.log(res.stdout)),
   *   ),
   *   pool.withLease(async (lease) =>
   *     lease
   *       .getExeUnit()
   *       .then((exe) => exe.run("echo Hello, Golem from the second machine! 👋"))
   *       .then((res) => console.log(res.stdout)),
   *   ),
   *   pool.withLease(async (lease) =>
   *     lease
   *       .getExeUnit()
   *       .then((exe) => exe.run("echo Hello, Golem from the third machine! 👋"))
   *       .then((res) => console.log(res.stdout)),
   *   ),
   * ]);
   * ```
   *
   * @param options Demand specification and concurrency level
   */
  public async manyOf({ concurrency, order, setup, teardown }: ManyOfOptions): Promise<LeaseProcessPool> {
    const proposalPool = new DraftOfferProposalPool({
      logger: this.logger,
      validateProposal: order.market.proposalFilter,
      selectProposal: order.market.proposalSelector,
    });

    const allocation = await this.getAllocationFromOrder({ order, concurrency });
    const demandSpecification = await this.market.buildDemandDetails(order.demand, allocation);

    const draftProposal$ = this.market.collectDraftOfferProposals({
      demandSpecification,
      pricing: order.market.pricing,
      filter: order.market.proposalFilter,
    });
    const subscription = proposalPool.readFrom(draftProposal$);

    const leaseProcessPool = this.lease.createLeaseProcessPool(proposalPool, allocation, {
      replicas: concurrency,
      network: order.network,
      leaseProcessOptions: {
        activity: order.activity,
        payment: order.payment,
        exeUnit: { setup, teardown },
      },
      agreementOptions: {
        expirationSec: order.market.rentHours * 60 * 60,
      },
    });
    this.cleanupTasks.push(() => {
      subscription.unsubscribe();
    });
    this.cleanupTasks.push(async () => {
      // First drain the pool (which will wait for all leases to be paid for)
      // and only then release the allocation
      await leaseProcessPool
        .drainAndClear()
        .catch((err) => this.logger.error("Error while draining lease process pool", err));
      // Don't release the allocation if it was provided by the user
      if (order.payment?.allocation) {
        return;
      }
      await this.payment
        .releaseAllocation(allocation)
        .catch((err) => this.logger.error("Error while releasing allocation", err));
    });

    return leaseProcessPool;
  }

  isConnected() {
    return this.hasConnection;
  }

  /**
   * Creates a new logical network within the Golem VPN infrastructure.
   * Allows communication between network nodes using standard network mechanisms,
   * but requires specific implementation in the ExeUnit/runtime,
   * which must be capable of providing a standard Unix-socket interface to their payloads
   * and marshaling the logical network traffic through the Golem Net transport layer
   * @param options
   */
  async createNetwork(options?: NetworkOptions): Promise<Network> {
    return await this.network.createNetwork(options);
  }

  /**
   * Removes an existing network from the Golem VPN infrastructure.
   * @param network
   */
  async destroyNetwork(network: Network): Promise<void> {
    return await this.network.removeNetwork(network);
  }

  private createStorageProvider(): StorageProvider {
    if (typeof this.options.dataTransferProtocol === "string") {
      switch (this.options.dataTransferProtocol) {
        case "ws":
          return new WebSocketBrowserStorageProvider(this.yagna, {});
        case "gftp":
        default:
          return new GftpStorageProvider();
      }
    } else if (this.options.dataTransferProtocol !== undefined) {
      return this.options.dataTransferProtocol;
    } else {
      return new NullStorageProvider();
    }
  }
}
