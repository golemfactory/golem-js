import { anyAbortSignal, createAbortSignalFromTimeout, defaultLogger, isNode, Logger, YagnaApi } from "../shared/utils";
import {
  Demand,
  DraftOfferProposalPool,
  IMarketApi,
  MarketModule,
  MarketModuleImpl,
  MarketModuleOptions,
  OfferProposal,
  OrderMarketOptions,
} from "../market";
import { Allocation, IPaymentApi, PaymentModule, PaymentModuleImpl, PaymentModuleOptions } from "../payment";
import { ActivityModule, ActivityModuleImpl, ExeUnitOptions, IActivityApi, IFileServer } from "../activity";
import { INetworkApi, Network, NetworkModule, NetworkModuleImpl, NetworkNode, NetworkOptions } from "../network";
import { EventEmitter } from "eventemitter3";
import {
  PoolSize,
  RentalModule,
  RentalModuleImpl,
  ResourceRental,
  ResourceRentalOptions,
  ResourceRentalPool,
} from "../resource-rental";
import { DebitNoteRepository, InvoiceRepository, MarketApiAdapter, PaymentApiAdapter } from "../shared/yagna";
import { ActivityApiAdapter } from "../shared/yagna/adapters/activity-api-adapter";
import { ActivityRepository } from "../shared/yagna/repository/activity-repository";
import { AgreementRepository } from "../shared/yagna/repository/agreement-repository";
import { ProposalRepository } from "../shared/yagna/repository/proposal-repository";
import { CacheService } from "../shared/cache/CacheService";
import { DemandRepository } from "../shared/yagna/repository/demand-repository";
import { IDemandRepository, OrderDemandOptions } from "../market/demand";
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
import { Subscription } from "rxjs";

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
   *
   * This is where you can specify the network, payment driver and more.
   * By default, the network is set to the `holesky` test network.
   */
  payment?: Partial<PaymentModuleOptions>;

  /**
   * Set market related options.
   *
   * This is where you can globally specify several options that determine how the SDK will
   * interact with the market.
   */
  market?: Partial<MarketModuleOptions>;

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
      rental: InstanceOrFactory<RentalModule>;
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
 * Represents the order specifications which will result in access to ResourceRental.
 */
export interface MarketOrderSpec {
  demand: OrderDemandOptions;
  market: OrderMarketOptions;
  activity?: ResourceRentalOptions["activity"];
  payment?: ResourceRentalOptions["payment"] & AllocationOptions;
  /** The network that should be used for communication between the resources rented as part of this order */
  network?: Network;
}

export interface GolemNetworkEvents {
  /** Fires when all startup operations related to GN are completed */
  connected: () => void;

  /** Fires when an error will be encountered */
  error: (error: Error) => void;

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
  poolSize: PoolSize;
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
  public readonly rental: RentalModule;

  /**
   * Dependency Container
   */
  public readonly services: GolemServices;

  private hasConnection = false;
  private disconnectPromise: Promise<void> | undefined;
  private abortController = new AbortController();

  private readonly storageProvider: StorageProvider;

  /**
   * List af additional tasks that should be executed when the network is being shut down
   * (for example finalizing resource rental created with `oneOf`)
   */
  private cleanupTasks: (() => Promise<void> | void)[] = [];

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
      this.market = getFactory(MarketModuleImpl, this.options.override?.market)(
        {
          ...this.services,
          networkModule: this.network,
        },
        this.options.market,
      );
      this.payment = getFactory(PaymentModuleImpl, this.options.override?.payment)(this.services, this.options.payment);
      this.activity = getFactory(ActivityModuleImpl, this.options.override?.activity)(this.services);
      this.rental = getFactory(
        RentalModuleImpl,
        this.options.override?.rental,
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

  private async startDisconnect() {
    try {
      this.abortController.abort("Golem Network is disconnecting");
      await Promise.allSettled(this.cleanupTasks.map((task) => task()));
      this.cleanupTasks = [];
      await this.storageProvider
        .close()
        .catch((err) => this.logger.warn("Closing storage provider resulted with an error, it will be ignored", err));
      await this.yagna
        .disconnect()
        .catch((err) =>
          this.logger.warn("Closing connections with yagna resulted with an error, it will be ignored", err),
        );
      this.services.proposalCache.flushAll();
      this.abortController = new AbortController();
    } catch (err) {
      this.logger.error("Error while disconnecting", err);
      throw err;
    } finally {
      this.events.emit("disconnected");
      this.hasConnection = false;
    }
  }

  /**
   * "Disconnects" from the Golem Network
   *
   * @return Resolves when all shutdown steps are completed
   */
  async disconnect() {
    if (this.disconnectPromise) {
      return this.disconnectPromise;
    }

    this.disconnectPromise = this.startDisconnect().finally(() => {
      this.disconnectPromise = undefined;
    });

    return this.disconnectPromise;
  }

  private async getAllocationFromOrder({
    order,
    maxAgreements,
  }: {
    order: MarketOrderSpec;
    maxAgreements: number;
  }): Promise<Allocation> {
    if (!order.payment?.allocation) {
      const budget = this.market.estimateBudget({ order, maxAgreements });

      /**
       * We need to create allocations that will exist longer than the agreements made.
       *
       * Without this in the event of agreement termination due to its expiry,
       * the invoice for the agreement arrives, and we try to accept the invoice with
       * an allocation that already expired (had the same expiration time as the agreement),
       * which leads to unpaid invoices.
       */
      const EXPIRATION_BUFFER_MINUTES = 15;

      return this.payment.createAllocation({
        budget,
        expirationSec: order.market.rentHours * (60 + EXPIRATION_BUFFER_MINUTES) * 60,
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
   * const rental = await glm.oneOf({ order });
   * await rental
   *  .getExeUnit()
   *  .then((exe) => exe.run("echo Hello, Golem! 👋"))
   *  .then((res) => console.log(res.stdout));
   * await rental.stopAndFinalize();
   * ```
   *
   * @param {Object} options
   * @param options.order - represents the order specifications which will result in access to ResourceRental.
   * @param options.signalOrTimeout - timeout in milliseconds or an AbortSignal that will be used to cancel the rental request
   * @param options.setup - an optional function that is called as soon as the exe unit is ready
   * @param options.teardown - an optional function that is called before the exe unit is destroyed
   */
  async oneOf({ order, setup, teardown, signalOrTimeout }: OneOfOptions): Promise<ResourceRental> {
    const signal = anyAbortSignal(createAbortSignalFromTimeout(signalOrTimeout), this.abortController.signal);

    let allocation: Allocation | undefined = undefined;
    let proposalSubscription: Subscription | undefined = undefined;
    let rental: ResourceRental | undefined = undefined;
    let networkNode: NetworkNode | undefined = undefined;

    const cleanup = async () => {
      if (proposalSubscription) {
        proposalSubscription.unsubscribe();
      }
      // First finalize the rental (which will wait for all payments to be processed)
      // and only then release the allocation
      if (rental) {
        await rental.stopAndFinalize().catch((err) => this.logger.error("Error while finalizing rental", err));
      }
      if (order.network && networkNode) {
        await this.network
          .removeNetworkNode(order.network, networkNode)
          .catch((err) => this.logger.error("Error while removing network node", err));
      }
      // Don't release the allocation if it was provided by the user
      if (order.payment?.allocation || !allocation) {
        return;
      }
      await this.payment
        .releaseAllocation(allocation)
        .catch((err) => this.logger.error("Error while releasing allocation", err));
    };
    try {
      const proposalPool = new DraftOfferProposalPool({
        logger: this.logger,
        validateOfferProposal: order.market.offerProposalFilter,
        selectOfferProposal: order.market.offerProposalSelector,
      });

      allocation = await this.getAllocationFromOrder({ order, maxAgreements: 1 });
      signal.throwIfAborted();

      const demandSpecification = await this.market.buildDemandDetails(order.demand, order.market, allocation);
      const draftProposal$ = this.market.collectDraftOfferProposals({
        demandSpecification,
        pricing: order.market.pricing,
        filter: order.market.offerProposalFilter,
      });

      proposalSubscription = proposalPool.readFrom(draftProposal$);
      const agreement = await this.market.signAgreementFromPool(
        proposalPool,
        {
          expirationSec: order.market.rentHours * 60 * 60,
        },
        signal,
      );

      networkNode = order.network
        ? await this.network.createNetworkNode(order.network, agreement.provider.id)
        : undefined;

      rental = this.rental.createResourceRental(agreement, allocation, {
        payment: order.payment,
        activity: order.activity,
        networkNode,
        exeUnit: { setup, teardown },
      });

      // We managed to create the activity, no need to look for more agreement candidates
      proposalSubscription.unsubscribe();

      this.cleanupTasks.push(cleanup);

      return rental;
    } catch (err) {
      this.logger.error("Error while creating rental", err);
      // if the execution was interrupted before we got the chance to add the cleanup task
      // we need to call it manually
      await cleanup();
      throw err;
    }
  }

  /**
   * Define your computational resource demand and access a pool of instances.
   * The pool will grow up to the specified poolSize.
   *
   * @example
   * ```ts
   * // create a pool that can grow up to 3 rentals at the same time
   * const pool = await glm.manyOf({
   *   poolSize: 3,
   *   demand
   * });
   * await Promise.allSettled([
   *   pool.withRental(async (rental) =>
   *     rental
   *       .getExeUnit()
   *       .then((exe) => exe.run("echo Hello, Golem from the first machine! 👋"))
   *       .then((res) => console.log(res.stdout)),
   *   ),
   *   pool.withRental(async (rental) =>
   *     rental
   *       .getExeUnit()
   *       .then((exe) => exe.run("echo Hello, Golem from the second machine! 👋"))
   *       .then((res) => console.log(res.stdout)),
   *   ),
   *   pool.withRental(async (rental) =>
   *     rental
   *       .getExeUnit()
   *       .then((exe) => exe.run("echo Hello, Golem from the third machine! 👋"))
   *       .then((res) => console.log(res.stdout)),
   *   ),
   * ]);
   * ```
   *
   * @param {Object} options
   * @param options.order - represents the order specifications which will result in access to LeaseProcess.
   * @param options.poolSize {Object | number} - can be defined as a number or an object with min and max fields, if defined as a number it will be treated as a min parameter.
   * @param options.poolSize.min - the minimum pool size to achieve ready state (default = 0)
   * @param options.poolSize.max - the maximum pool size, if reached, the next pool element will only be available if the borrowed resource is released or destroyed (dafault = 100)
   * @param options.setup - an optional function that is called as soon as the exe unit is ready
   * @param options.teardown - an optional function that is called before the exe unit is destroyed
   */
  public async manyOf({ poolSize, order, setup, teardown }: ManyOfOptions): Promise<ResourceRentalPool> {
    const signal = this.abortController.signal;
    let allocation: Allocation | undefined = undefined;
    let resourceRentalPool: ResourceRentalPool | undefined = undefined;
    let subscription: Subscription | undefined = undefined;

    const cleanup = async () => {
      if (subscription) {
        subscription.unsubscribe();
      }
      // First drain the pool (which will wait for all rentals to be paid for
      // and only then release the allocation
      if (resourceRentalPool) {
        await resourceRentalPool
          .drainAndClear()
          .catch((err) => this.logger.error("Error while draining resource rental pool", err));
      }
      // Don't release the allocation if it was provided by the user
      if (order.payment?.allocation || !allocation) {
        return;
      }
      await this.payment
        .releaseAllocation(allocation)
        .catch((err) => this.logger.error("Error while releasing allocation", err));
    };

    try {
      const proposalPool = new DraftOfferProposalPool({
        logger: this.logger,
        validateOfferProposal: order.market.offerProposalFilter,
        selectOfferProposal: order.market.offerProposalSelector,
      });

      const maxAgreements = typeof poolSize === "number" ? poolSize : poolSize?.max ?? poolSize?.min ?? 1;
      allocation = await this.getAllocationFromOrder({ order, maxAgreements });
      signal.throwIfAborted();

      const demandSpecification = await this.market.buildDemandDetails(order.demand, order.market, allocation);

      const draftProposal$ = this.market.collectDraftOfferProposals({
        demandSpecification,
        pricing: order.market.pricing,
        filter: order.market.offerProposalFilter,
      });
      subscription = proposalPool.readFrom(draftProposal$);

      const rentSeconds = order.market.rentHours * 60 * 60;

      resourceRentalPool = this.rental.createResourceRentalPool(proposalPool, allocation, {
        poolSize,
        network: order.network,
        resourceRentalOptions: {
          activity: order.activity,
          payment: order.payment,
          exeUnit: { setup, teardown },
        },
        agreementOptions: {
          expirationSec: rentSeconds,
        },
      });

      this.cleanupTasks.push(cleanup);

      return resourceRentalPool;
    } catch (err) {
      this.logger.error("Error while creating rental pool", err);
      // if the execution was interrupted before we got the chance to add the cleanup task
      // we need to call it manually
      await cleanup();
      throw err;
    }
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
          return new WebSocketBrowserStorageProvider(this.yagna, {
            logger: this.logger,
          });
        case "gftp":
        default:
          return new GftpStorageProvider(this.logger);
      }
    } else if (this.options.dataTransferProtocol !== undefined) {
      return this.options.dataTransferProtocol;
    } else {
      return new NullStorageProvider();
    }
  }
}
