import { DeploymentOptions, GolemDeploymentBuilder, MarketOptions, PaymentOptions } from "./experimental";
import { defaultLogger, Logger, YagnaApi } from "./shared/utils";
import { DemandSpec, DraftOfferProposalPool, MarketModule, MarketModuleImpl } from "./market";
import { Allocation, PaymentModule, PaymentModuleImpl } from "./payment";
import { ActivityModule, ActivityModuleImpl } from "./activity";
import { NetworkModule, NetworkModuleImpl } from "./network/network.module";
import { EventEmitter } from "eventemitter3";
import { IPaymentApi, LeaseProcess } from "./agreement";
import { Package } from "./market/package";
import { DebitNoteRepository, InvoiceRepository, PaymentApiAdapter } from "./shared/yagna";

export interface GolemNetworkOptions {
  logger?: Logger;
  api?: {
    key: string;
    url: string;
  };
  market?: Partial<MarketOptions>;
  payment?: Partial<PaymentOptions>;
  deployment?: Partial<DeploymentOptions>;
  dataTransferProtocol?: DeploymentOptions["dataTransferProtocol"];
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
};

/**
 * General purpose and high-level API for the Golem Network
 *
 * This class is the main entry-point for developers that would like to build on Golem Network
 * using `@golem-sdk/golem-js`. It is supposed to provide an easy access API for use 80% of use cases.
 */
export class GolemNetwork {
  public readonly events = new EventEmitter<GolemNetworkEvents>();

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

  constructor(public readonly options: GolemNetworkOptions = {}) {
    this.logger = options.logger ?? defaultLogger("golem-network");

    try {
      this.yagna = new YagnaApi({
        logger: this.logger,
        apiKey: this.options.api?.key,
        basePath: this.options.api?.url,
      });

      this.services = {
        logger: this.logger,
        yagna: this.yagna,
        paymentApi: new PaymentApiAdapter(
          this.yagna,
          new InvoiceRepository(this.yagna.payment, this.yagna.market),
          new DebitNoteRepository(this.yagna.payment, this.yagna.market),
          this.logger,
        ),
      };

      this.market = new MarketModuleImpl(this.services);
      this.payment = new PaymentModuleImpl(this.services);
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
      this.events.emit("connected");
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
    await this.services.paymentApi.disconnect();
    await this.yagna.disconnect();
    this.events.emit("disconnected");
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

    const workload = Package.create({
      imageTag: demand.demand.image,
    });

    const allocation = await Allocation.create(this.yagna, {
      account: {
        address: (await this.yagna.identity.getIdentity()).identity,
        platform: "erc20-holesky-tglm",
      },
      budget: 1,
    });

    const demandOffer = await this.market.buildDemand(workload, allocation, {});

    const proposalSubscription = this.market
      .startCollectingProposals({
        demandOffer,
        paymentPlatform: "erc20-holesky-tglm",
      })
      .subscribe((proposalsBatch) => proposalsBatch.forEach((proposal) => proposalPool.add(proposal)));

    const draftProposal = await proposalPool.acquire();

    const agreement = await this.market.proposeAgreement(this.payment, draftProposal);
    proposalSubscription.unsubscribe();

    const lease = this.market.createLease(agreement, allocation);

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
}
