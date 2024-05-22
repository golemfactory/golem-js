import { DataTransferProtocol, DeploymentOptions, GolemDeploymentBuilder } from "../deployment";
import { defaultLogger, Logger, YagnaApi } from "../shared/utils";
import {
  Demand,
  DemandSpec,
  DraftOfferProposalPool,
  MarketApi,
  MarketModule,
  MarketModuleImpl,
  MarketOptions,
  OfferProposal,
} from "../market";
import { IPaymentApi, PaymentModule, PaymentModuleImpl, PaymentModuleOptions } from "../payment";
import { ActivityModule, ActivityModuleImpl, IActivityApi, IFileServer } from "../activity";
import { NetworkModule, NetworkModuleImpl } from "../network/network.module";
import { EventEmitter } from "eventemitter3";
import { LeaseProcess, LeaseProcessPool } from "../agreement";
import { DebitNoteRepository, InvoiceRepository, MarketApiAdapter, PaymentApiAdapter } from "../shared/yagna";
import { ActivityApiAdapter } from "../shared/yagna/adapters/activity-api-adapter";
import { ActivityRepository } from "../shared/yagna/repository/activity-repository";
import { AgreementRepository } from "../shared/yagna/repository/agreement-repository";
import { IAgreementApi } from "../agreement/agreement";
import { AgreementApiAdapter } from "../shared/yagna/adapters/agreement-api-adapter";
import { ProposalRepository } from "../shared/yagna/repository/proposal-repository";
import { CacheService } from "../shared/cache/CacheService";
import { IProposalRepository } from "../market/offer-proposal";
import { DemandRepository } from "../shared/yagna/repository/demand-repository";
import { IDemandRepository } from "../market/demand";
import { GftpServerAdapter } from "../shared/storage/GftpServerAdapter";
import {
  GftpStorageProvider,
  NullStorageProvider,
  StorageProvider,
  WebSocketBrowserStorageProvider,
} from "../shared/storage";

export interface GolemNetworkOptions {
  logger?: Logger;
  api?: {
    key?: string;
    url?: string;
  };
  market?: Partial<MarketOptions>;
  payment?: PaymentModuleOptions;
  deployment?: Partial<DeploymentOptions>;
  dataTransferProtocol?: DataTransferProtocol;
  override?: Partial<
    GolemServices & {
      market: MarketModule;
      payment: PaymentModule;
      activity: ActivityModule;
      network: NetworkModule;
    }
  >;
}

export interface GolemNetworkEvents {
  /** Fires when all startup operations related to GN are completed */
  connected: () => void;

  /** Fires when an error will be encountered */
  error: (err: Error) => void;

  /** Fires when all shutdown operations related to GN are completed */
  disconnected: () => void;
}

/**
 * Dependency Container
 */
export type GolemServices = {
  yagna: YagnaApi;
  logger: Logger;
  paymentApi: IPaymentApi;
  activityApi: IActivityApi;
  agreementApi: IAgreementApi;
  marketApi: MarketApi;
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
      dataTransferProtocol: "gftp",
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
      const proposalRepository = new ProposalRepository(this.yagna.market, proposalCache);
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
            new ActivityRepository(this.yagna.activity.state, agreementRepository),
          ),
        agreementApi:
          this.options.override?.agreementApi ||
          new AgreementApiAdapter(this.yagna.appSessionId, this.yagna.market, agreementRepository, this.logger),
        marketApi: this.options.override?.marketApi || new MarketApiAdapter(this.yagna, this.logger),
        fileServer: this.options.override?.fileServer || new GftpServerAdapter(this.storageProvider),
      };

      this.market = this.options.override?.market || new MarketModuleImpl(this.services);
      this.payment = this.options.override?.payment || new PaymentModuleImpl(this.services, this.options.payment);
      this.activity = this.options.override?.activity || new ActivityModuleImpl(this.services);
      this.network = this.options.override?.network || new NetworkModuleImpl();
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

  /**
   * Creates a new instance of deployment builder that will be bound to this GolemNetwork instance
   *
   * Use Case: Building a complex deployment topology and requesting resources for the whole construct
   *
   * @return The new instance of the builder
   */
  creteDeploymentBuilder(): GolemDeploymentBuilder {
    return new GolemDeploymentBuilder(this);
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
   * @param demand
   */
  async oneOf(demand: DemandSpec): Promise<LeaseProcess> {
    const proposalPool = new DraftOfferProposalPool({
      logger: this.logger,
    });

    const budget = this.market.estimateBudget(demand);
    const allocation = await this.payment.createAllocation({
      budget,
      expirationSec: demand.market.rentHours * 60 * 60,
    });
    const demandSpecification = await this.market.buildDemandDetails(demand.demand, allocation);

    const proposal$ = this.market.startCollectingProposals({
      demandSpecification,
    });
    const proposalSubscription = proposalPool.readFrom(proposal$);

    const draftProposal = await proposalPool.acquire();

    const agreement = await this.market.proposeAgreement(draftProposal);

    const lease = this.market.createLease(agreement, allocation);

    // We managed to create the activity, no need to look for more agreement candidates
    proposalSubscription.unsubscribe();

    this.cleanupTasks.push(async () => {
      // First finalize the lease (which will wait for all payments to be processed)
      // and only then release the allocation
      await lease.finalize().catch((err) => this.logger.error("Error while finalizing lease", err));
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
   * const pool = await glm.manyOf(3, demand);
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
   * @param concurrency Maximum number of leases that can be active at the same time
   * @param demand Demand specification
   */
  public async manyOf(concurrency: number, demand: DemandSpec): Promise<LeaseProcessPool> {
    const proposalPool = new DraftOfferProposalPool({
      logger: this.logger,
    });

    const budget = this.market.estimateBudget(demand);
    const allocation = await this.payment.createAllocation({
      budget,
      expirationSec: demand.market.rentHours * 60 * 60,
    });
    const demandSpecification = await this.market.buildDemandDetails(demand.demand, allocation);

    const proposal$ = this.market.startCollectingProposals({
      demandSpecification,
    });
    const subscription = proposalPool.readFrom(proposal$);

    const leaseProcessPool = this.market.createLeaseProcessPool(proposalPool, allocation, {
      replicas: concurrency,
    });
    this.cleanupTasks.push(() => subscription.unsubscribe());
    this.cleanupTasks.push(async () => {
      // First drain the pool (which will wait for all leases to be paid for)
      // and only then release the allocation
      await leaseProcessPool
        .drainAndClear()
        .catch((err) => this.logger.error("Error while draining lease process pool", err));
      await this.payment
        .releaseAllocation(allocation)
        .catch((err) => this.logger.error("Error while releasing allocation", err));
    });

    return leaseProcessPool;
  }

  isConnected() {
    return this.hasConnection;
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
