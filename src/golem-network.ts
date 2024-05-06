import { DataTransferProtocol, DeploymentOptions, GolemDeploymentBuilder, MarketOptions } from "./experimental";
import { defaultLogger, Logger, YagnaApi } from "./shared/utils";
import {
  DemandNew,
  DemandSpec,
  DraftOfferProposalPool,
  MarketApi,
  MarketModule,
  MarketModuleImpl,
  ProposalNew,
} from "./market";
import { PaymentModule, PaymentModuleImpl, PaymentModuleOptions } from "./payment";
import { ActivityModule, ActivityModuleImpl, IFileServer } from "./activity";
import { NetworkModule, NetworkModuleImpl } from "./network/network.module";
import { EventEmitter } from "eventemitter3";
import { IActivityApi, IPaymentApi, LeaseProcess } from "./agreement";
import { DebitNoteRepository, InvoiceRepository, MarketApiAdapter, PaymentApiAdapter } from "./shared/yagna";
import { ActivityApiAdapter } from "./shared/yagna/adapters/activity-api-adapter";
import { ActivityRepository } from "./shared/yagna/repository/activity-repository";
import { AgreementRepository } from "./shared/yagna/repository/agreement-repository";
import { IAgreementApi } from "./agreement/agreement";
import { AgreementApiAdapter } from "./shared/yagna/adapters/agreement-api-adapter";
import { ProposalRepository } from "./shared/yagna/repository/proposal-repository";
import { CacheService } from "./shared/cache/CacheService";
import { IProposalRepository } from "./market/proposal";
import { DemandRepository } from "./shared/yagna/repository/demand-repository";
import { IDemandRepository } from "./market/demand";
import { GftpServerAdapter } from "./shared/storage/GftpServerAdapter";
import {
  GftpStorageProvider,
  NullStorageProvider,
  StorageProvider,
  WebSocketBrowserStorageProvider,
} from "./shared/storage";

export interface GolemNetworkOptions {
  logger?: Logger;
  api?: {
    key?: string;
    url?: string;
  };
  market?: Partial<MarketOptions>;
  payment?: PaymentModuleOptions;
  deployment?: Partial<DeploymentOptions>;
  dataTransferProtocol: DataTransferProtocol;
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
  proposalCache: CacheService<ProposalNew>;
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
      this.yagna = new YagnaApi({
        logger: this.logger,
        apiKey: this.options.api?.key,
        basePath: this.options.api?.url,
      });

      this.storageProvider = this.createStorageProvider();

      const demandCache = new CacheService<DemandNew>();
      const proposalCache = new CacheService<ProposalNew>();

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
        paymentApi: new PaymentApiAdapter(
          this.yagna,
          new InvoiceRepository(this.yagna.payment, this.yagna.market),
          new DebitNoteRepository(this.yagna.payment, this.yagna.market),
          this.logger,
        ),
        activityApi: new ActivityApiAdapter(
          this.yagna.activity.state,
          this.yagna.activity.control,
          new ActivityRepository(this.yagna.activity.state, agreementRepository),
        ),
        agreementApi: new AgreementApiAdapter(
          this.yagna.appSessionId,
          this.yagna.market,
          agreementRepository,
          this.logger,
        ),
        marketApi: new MarketApiAdapter(this.yagna, this.logger),
        fileServer: new GftpServerAdapter(this.storageProvider),
      };

      this.market = new MarketModuleImpl(this.services);
      this.payment = new PaymentModuleImpl(this.services, this.options.payment);
      this.activity = new ActivityModuleImpl(this.services);

      this.network = new NetworkModuleImpl();
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
   * const result = await glm
   *    .oneOf(spec)
   *    .then((lease) => lease.getExeUnit())
   *    .then((exe) => exe.run("echo 'Hello World'"))
   *    .then((res) => res.stdout);
   * ```
   *
   * @param demand
   */
  async oneOf(demand: DemandSpec): Promise<LeaseProcess> {
    const proposalPool = new DraftOfferProposalPool({
      logger: this.logger,
    });
    const payerDetails = await this.payment.getPayerDetails();
    const demandSpecification = await this.market.buildDemand(demand.demand, payerDetails);

    const proposalSubscription = this.market
      .startCollectingProposals({
        demandSpecification,
      })
      .subscribe((proposalsBatch) => proposalsBatch.forEach((proposal) => proposalPool.add(proposal)));

    const draftProposal = await proposalPool.acquire();

    const agreement = await this.market.proposeAgreement(draftProposal);
    proposalSubscription.unsubscribe();

    const allocation = await this.payment.createAllocation({ budget: 1 });
    const lease = this.market.createLease(agreement, allocation);

    // We managed to create the activity, no need to look for more agreement candidates
    proposalSubscription.unsubscribe();

    return lease;

    // TODO: Maintain a in-memory repository (pool) of Leases, so that when glm.disconnect() will be called, we can call this.leaseRepository.clear(), which will cleanly shut all of them down
  }

  /**
   * Define your computational resource demand for many instances, and access any of the instances from within a resource group
   *
   * Use Case: Get resources from the market for the same purpose, grouped together and schedule operations towards the group instead of individual resources
   *
   * @example
   * ```ts
   * const result = await glm
   *   .manyOf(spec)
   *   .then(group => group.exec((exe) => exe.run("echo 'HelloWorld'")))
   *   .then(res => res.stdout)
   * ```
   *
   * @param demand
   */
  // public manyOf(demand: DemandBuildParams): ResourceGroup<LeaseProcess> {
  //   throw new Error("Not implemented");
  // }

  /**
   * Use Case: Get resources for different purposes from the market, grouped per purpose and schedule operations toward particular groups
   *
   * @example
   * ```ts
   * const order = await glm
   *  .compose()
   *  .addNetwork("default", netConfig)
   *  .addResourceGroup("one", specOne)
   *  .addResourceGroup("two", specTwo)
   *  .addResourcesToNetwork("one", "default")
   *  .addResourcesToNetwork("two", "default)
   *  .validate() <--- check if we have cash before we start? :)
   *  .request();
   *
   * await order.getResourceGroup("one").exec((exe) => exe.run("echo 'Hello One!'"));
   * await order.getResourceGroup("two").exec((exe) => exe.run("echo 'Hello Two!'"));
   * ```
   */
  // public compose(): void {}
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
