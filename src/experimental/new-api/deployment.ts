import { GolemAbortError, GolemUserError } from "../../shared/error/golem-error";
import { defaultLogger, Logger, YagnaApi } from "../../shared/utils";
import { EventEmitter } from "eventemitter3";
import { ActivityModule, ActivityPool, ActivityPoolOptions } from "../../activity";
import { Network, NetworkOptions } from "../../network";
import { GftpStorageProvider, StorageProvider, WebSocketBrowserStorageProvider } from "../../shared/storage";
import { validateDeployment } from "./validate-deployment";
import { DemandBuildParams, DraftOfferProposalPool, MarketModule } from "../../market";
import { PaymentModule } from "../../payment";
import { AgreementPool, AgreementPoolOptions } from "../../agreement";
import { CreateActivityPoolOptions } from "./builder";
import { Subscription } from "rxjs";
import { IAgreementApi } from "../../agreement/agreement";

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

export type DataTransferProtocol = "gftp" | "ws" | StorageProvider;

export interface DeploymentOptions {
  dataTransferProtocol?: DataTransferProtocol;
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

  private readonly agreementApi: IAgreementApi;

  constructor(
    private readonly components: DeploymentComponents,
    deps: {
      logger: Logger;
      yagna: YagnaApi;
      market: MarketModule;
      activity: ActivityModule;
      payment: PaymentModule;
      agreementApi: IAgreementApi;
    },
    options: DeploymentOptions,
  ) {
    validateDeployment(components);

    const { logger, yagna, agreementApi, ...modules } = deps;

    this.logger = logger ?? defaultLogger("deployment");
    this.yagnaApi = yagna;

    this.modules = modules;

    this.agreementApi = agreementApi;

    this.dataTransferProtocol = this.getStorageProvider(options.dataTransferProtocol);

    this.abortController.signal.addEventListener("abort", () => {
      this.logger.info("Abort signal received");
      this.stop().catch((e) => {
        this.logger.error("stop() error on abort", { error: e });
        // TODO: should the error be sent to event listener?
      });
    });
  }

  private getStorageProvider(protocol: DataTransferProtocol | StorageProvider = "gftp"): StorageProvider {
    if (protocol === "gftp") {
      return new GftpStorageProvider();
    }

    if (protocol === "ws") {
      return new WebSocketBrowserStorageProvider(this.yagnaApi, {});
    }

    return protocol;
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

    // TODO: allocation is not used in this api?
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const allocation = await this.modules.payment.createAllocation({
      budget: 1,
    });
    const payerDetails = await this.modules.payment.getPayerDetails();

    for (const network of this.components.networks) {
      const networkInstance = await Network.create(this.yagnaApi, network.options);
      this.networks.set(network.name, networkInstance);
    }
    // TODO: add pool to network
    // TODO: pass dataTransferProtocol to pool
    for (const pool of this.components.activityPools) {
      const { demandBuildOptions, agreementPoolOptions, activityPoolOptions } = this.prepareParams(pool.options);

      const demandDetails = await this.modules.market.buildDemandDetails(demandBuildOptions.demand, payerDetails);
      const proposalPool = new DraftOfferProposalPool();

      const proposalSubscription = this.modules.market
        .startCollectingProposals({
          demandDetails: demandDetails,
          bufferSize: 10,
        })
        .subscribe({
          next: (proposals) => proposals.forEach((proposal) => proposalPool.add(proposal)),
          error: (e) => this.logger.error("Error while collecting proposals", e),
        });

      const agreementPool = new AgreementPool(proposalPool, this.agreementApi, agreementPoolOptions);
      const activityPool = new ActivityPool(this.modules, agreementPool, activityPoolOptions);
      this.pools.set(pool.name, {
        proposalPool,
        proposalSubscription,
        agreementPool,
        activityPool,
      });
    }

    await this.waitForDeployment();

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
          pool.agreementPool.drainAndClear(),
          pool.activityPool.drainAndClear(),
        ]),
      );
      await Promise.allSettled(stopPools);

      const stopNetworks: Promise<void>[] = Array.from(this.networks.values()).map((network) => network.remove());
      await Promise.allSettled(stopNetworks);

      this.state = DeploymentState.STOPPED;
    } catch (err) {
      this.logger.error("The deployment failed with an error", err);
      this.state = DeploymentState.ERROR;
      throw err;
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

  private async waitForDeployment() {
    this.logger.info("Waiting for all components to be deployed...");
    const readyActivityPools = [...this.pools.values()].map((component) => component.activityPool.ready());
    await Promise.all(readyActivityPools);
    this.logger.info("Components deployed and ready to use");
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
