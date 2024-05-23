import { GolemAbortError, GolemUserError } from "../shared/error/golem-error";
import { defaultLogger, Logger, YagnaApi } from "../shared/utils";
import { EventEmitter } from "eventemitter3";
import { ActivityModule } from "../activity";
import { Network, NetworkOptions } from "../network";
import { GftpStorageProvider, StorageProvider, WebSocketBrowserStorageProvider } from "../shared/storage";
import { validateDeployment } from "./validate-deployment";
import { DemandBuildParams, DraftOfferProposalPool, MarketModule } from "../market";
import { PaymentModule } from "../payment";
import { CreateActivityPoolOptions } from "./builder";
import { Subscription } from "rxjs";
import { LeaseProcessPool, LeaseProcessPoolOptions } from "../lease-process";

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
      leaseProcessPool: LeaseProcessPool;
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
    deps: {
      logger: Logger;
      yagna: YagnaApi;
      market: MarketModule;
      activity: ActivityModule;
      payment: PaymentModule;
    },
    options: DeploymentOptions,
  ) {
    validateDeployment(components);

    const { logger, yagna, ...modules } = deps;

    this.logger = logger ?? defaultLogger("deployment");
    this.yagnaApi = yagna;

    this.modules = modules;

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

    for (const network of this.components.networks) {
      const networkInstance = await Network.create(this.yagnaApi, network.options);
      this.networks.set(network.name, networkInstance);
    }

    // TODO: Derive this from deployment spec
    const allocation = await this.modules.payment.createAllocation({
      budget: 1,
      expirationSec: 30 * 60, // 30 minutes
    });

    // TODO: add pool to network
    // TODO: pass dataTransferProtocol to pool
    for (const pool of this.components.activityPools) {
      const { demandBuildOptions, leaseProcessPoolOptions } = this.prepareParams(pool.options);

      const demandSpecification = await this.modules.market.buildDemandDetails(demandBuildOptions.demand, allocation);
      const proposalPool = new DraftOfferProposalPool();

      const proposalSubscription = this.modules.market
        .startCollectingProposals({
          demandSpecification,
          bufferSize: 10,
        })
        .subscribe({
          next: (proposals) => proposals.forEach((proposal) => proposalPool.add(proposal)),
          error: (e) => this.logger.error("Error while collecting proposals", e),
        });

      const leaseProcessPool = this.modules.market.createLeaseProcessPool(
        proposalPool,
        allocation,
        leaseProcessPoolOptions,
      );
      this.pools.set(pool.name, {
        proposalPool,
        proposalSubscription,
        leaseProcessPool,
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
        Promise.allSettled([pool.proposalSubscription.unsubscribe(), pool.leaseProcessPool.drainAndClear()]),
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

  getLeaseProcessPool(name: string): LeaseProcessPool {
    const pool = this.pools.get(name);
    if (!pool) {
      throw new GolemUserError(`LeaseProcessPool ${name} not found`);
    }
    return pool.leaseProcessPool;
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
    const readyPools = [...this.pools.values()].map((component) => component.leaseProcessPool.ready());
    await Promise.all(readyPools);
    this.logger.info("Components deployed and ready to use");
  }

  private prepareParams(options: CreateActivityPoolOptions): {
    demandBuildOptions: DemandBuildParams;
    leaseProcessPoolOptions: LeaseProcessPoolOptions;
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
      leaseProcessPoolOptions: {
        agreementOptions: { invoiceFilter: options.payment?.invoiceFilter },
        replicas,
      },
    };
  }
}
