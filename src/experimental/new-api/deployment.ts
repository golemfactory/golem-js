import { GolemAbortError, GolemUserError } from "../../shared/error/golem-error";
import { defaultLogger, Logger, YagnaApi } from "../../shared/utils";
import { EventEmitter } from "eventemitter3";
import { ActivityModule, ActivityModuleImpl, ActivityPool, ActivityPoolOptions } from "../../activity";
import { MarketOptions, PaymentOptions } from "./types";
import { Network, NetworkOptions } from "../../network";
import { GftpStorageProvider, StorageProvider, WebSocketBrowserStorageProvider } from "../../shared/storage";
import { validateDeployment } from "./validate-deployment";
import { DemandBuildParams, DraftOfferProposalPool, MarketModule, MarketModuleImpl } from "../../market";
import { Allocation, PaymentModule, PaymentModuleImpl } from "../../payment";
import { AgreementPool, AgreementPoolOptions } from "../../agreement";
import { CreateActivityPoolOptions } from "./builder";
import { Package } from "../../market/package";
import { Subscription } from "rxjs";

export enum DeploymentState {
  INITIAL = "INITIAL",
  STARTING = "STARTING",
  READY = "READY",
  STOPPING = "STOPPING",
  STOPPED = "STOPPED",
  ERROR = "ERROR",
}

export interface DeploymentEvents {
  /**
   * Fires when backend is started.
   */
  ready: () => void;

  /**
   * Fires when a new instance encounters an error during initialization.
   * @param error
   */
  // activityInitError: (error: ActivityInitError) => void;

  /**
   * Fires when backend is about to be stopped.
   */
  beforeEnd: () => void;

  /**
   * Fires when backend is completely terminated.
   */
  end: () => void;
}

export type DeploymentComponents = {
  activityPools: { name: string; options: CreateActivityPoolOptions }[];
  networks: { name: string; options: NetworkOptions }[];
};

export interface DeploymentOptions {
  logger?: Logger;
  api: {
    key: string;
    url: string;
  };
  market?: Partial<MarketOptions>;
  payment?: Partial<PaymentOptions>;
  dataTransferProtocol?: "gftp" | "ws" | StorageProvider;
}

/**
 * @experimental This feature is experimental!!!
 */
export class Deployment {
  readonly events = new EventEmitter<DeploymentEvents>();

  private state: DeploymentState = DeploymentState.INITIAL;

  private readonly logger: Logger;
  private readonly abortController = new AbortController();

  private readonly yagnaApi: YagnaApi;

  private readonly pools = new Map<
    string,
    {
      proposalPool: DraftOfferProposalPool;
      proposalSubscription: Subscription;
      agreementPool: AgreementPool;
      activityPool: ActivityPool;
    }
  >();
  private readonly networks = new Map<string, Network>();
  private readonly dataTransferProtocol: StorageProvider;
  private readonly modules: {
    market: MarketModule;
    activity: ActivityModule;
    payment: PaymentModule;
  };

  constructor(
    private readonly components: DeploymentComponents,
    private readonly options: DeploymentOptions,
  ) {
    validateDeployment(components);
    this.logger = options.logger ?? defaultLogger("deployment");

    this.yagnaApi = new YagnaApi({
      apiKey: options.api.key,
      basePath: options.api.url,
    });

    this.modules = {
      market: new MarketModuleImpl(this.yagnaApi),
      activity: new ActivityModuleImpl(this.yagnaApi),
      payment: new PaymentModuleImpl(this.yagnaApi),
    };

    this.dataTransferProtocol = this.getDataTransferProtocol(options, this.yagnaApi);

    this.abortController.signal.addEventListener("abort", () => {
      this.logger.info("Abort signal received");
      this.stop().catch((e) => {
        this.logger.error("stop() error on abort", { error: e });
        // TODO: should the error be sent to event listener?
      });
    });
  }

  private getDataTransferProtocol(options: DeploymentOptions, yagnaApi: YagnaApi): StorageProvider {
    if (!options.dataTransferProtocol || options.dataTransferProtocol === "gftp") {
      return new GftpStorageProvider();
    }
    if (options.dataTransferProtocol === "ws") {
      return new WebSocketBrowserStorageProvider(yagnaApi, {});
    }
    return options.dataTransferProtocol;
  }

  getState(): DeploymentState {
    return this.state;
  }

  async start() {
    if (this.abortController.signal.aborted) {
      throw new GolemAbortError("Calling start after abort signal received");
    }

    if (this.state != DeploymentState.INITIAL) {
      throw new GolemUserError(`Cannot start backend, expected backend state INITIAL, current state is ${this.state}`);
    }

    await this.dataTransferProtocol.init();

    const allocation = await Allocation.create(this.yagnaApi, {
      account: {
        address: (await this.yagnaApi.identity.getIdentity()).identity,
        platform: "erc20-holesky-tglm", //TODO: add platform to deployment options
      },
      budget: 1,
    });

    for (const network of this.components.networks) {
      const networkInstance = await Network.create(this.yagnaApi, network.options);
      this.networks.set(network.name, networkInstance);
    }
    // TODO: add pool to network
    // TODO: pass dataTransferProtocol to pool
    for (const pool of this.components.activityPools) {
      const { demandBuildOptions, agreementPoolOptions, activityPoolOptions } = this.prepareParams(pool.options);
      const workload = Package.create({
        imageTag: pool.options.demand.image,
      });
      const demandOffer = await this.modules.market.buildDemand(workload, allocation, {});
      const proposalPool = new DraftOfferProposalPool();

      const proposalSubscription = this.modules.market
        .startCollectingProposals({
          demandOffer,
          paymentPlatform: "erc20-holesky-tglm",
          demandOptions: demandBuildOptions.demand,
        })
        .subscribe({
          next: (proposals) => {
            proposals.forEach((proposal) => proposalPool.add(proposal));
          },
          error: (e) => {
            this.logger.error("Error while collecting proposals", e);
          },
        });

      const agreementPool = new AgreementPool(this.modules, proposalPool, agreementPoolOptions);
      const activityPool = new ActivityPool(this.modules, agreementPool, activityPoolOptions);
      this.pools.set(pool.name, {
        proposalPool,
        proposalSubscription,
        agreementPool,
        activityPool,
      });
    }

    this.events.emit("ready");
  }

  async stop() {
    if (this.state === DeploymentState.STOPPING || this.state === DeploymentState.STOPPED) {
      return;
    }

    this.state = DeploymentState.STOPPING;
    this.events.emit("beforeEnd");

    try {
      this.abortController.abort();

      this.dataTransferProtocol.close();

      const stopPools = Array.from(this.pools.values()).map((pool) =>
        Promise.allSettled([
          pool.proposalSubscription.unsubscribe(),
          pool.agreementPool.drain(),
          pool.activityPool.drain(),
        ]),
      );
      await Promise.allSettled(stopPools);

      const stopNetworks: Promise<void>[] = Array.from(this.networks.values()).map((network) => network.remove());
      await Promise.allSettled(stopNetworks);

      this.state = DeploymentState.STOPPED;
    } catch (e) {
      this.state = DeploymentState.ERROR;
      throw e;
    }

    this.events.emit("end");
  }

  getActivityPool(name: string): ActivityPool {
    const pool = this.pools.get(name);
    if (!pool) {
      throw new GolemUserError(`ActivityPool ${name} not found`);
    }
    return pool.activityPool;
  }

  getNetwork(name: string): Network {
    const network = this.networks.get(name);
    if (!network) {
      throw new GolemUserError(`Network ${name} not found`);
    }
    return network;
  }

  private prepareParams(options: CreateActivityPoolOptions): {
    demandBuildOptions: DemandBuildParams;
    activityPoolOptions: ActivityPoolOptions;
    agreementPoolOptions: AgreementPoolOptions;
  } {
    const replicas =
      typeof options.deployment?.replicas === "number"
        ? { min: options.deployment?.replicas, max: options.deployment?.replicas }
        : typeof options.deployment?.replicas === "object"
          ? options.deployment?.replicas
          : { min: 1, max: 1 };
    return {
      demandBuildOptions: {
        demand: options.demand,
        market: options.market,
      },
      activityPoolOptions: {
        logger: this.logger.child("activity-pool"),
        replicas,
      },
      agreementPoolOptions: {
        logger: this.logger.child("agreement-pool"),
        agreementOptions: { invoiceFilter: options.payment?.invoiceFilter },
      },
    };
  }
}
