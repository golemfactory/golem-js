import { GolemAbortError, GolemUserError } from "../../shared/error/golem-error";
import { defaultLogger, Logger, YagnaApi } from "../../shared/utils";
import { EventEmitter } from "eventemitter3";
import { ActivityModule } from "../../activity";
import { Network, NetworkModule, NetworkOptions } from "../../network";
import { validateDeployment } from "./validate-deployment";
import { DraftOfferProposalPool, MarketModule } from "../../market";
import { PaymentModule } from "../../payment";
import { CreateLeaseProcessPoolOptions } from "./builder";
import { Subscription } from "rxjs";
import { LeaseModule, LeaseProcessPool } from "../../lease-process";

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
  leaseProcessPools: { name: string; options: CreateLeaseProcessPoolOptions }[];
  networks: { name: string; options: NetworkOptions }[];
};

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

  private readonly modules: {
    market: MarketModule;
    activity: ActivityModule;
    payment: PaymentModule;
    network: NetworkModule;
    lease: LeaseModule;
  };

  constructor(
    private readonly components: DeploymentComponents,
    deps: {
      logger: Logger;
      yagna: YagnaApi;
      market: MarketModule;
      activity: ActivityModule;
      payment: PaymentModule;
      network: NetworkModule;
      lease: LeaseModule;
    },
  ) {
    validateDeployment(components);

    const { logger, yagna, ...modules } = deps;

    this.logger = logger ?? defaultLogger("deployment");
    this.yagnaApi = yagna;

    this.modules = modules;

    this.abortController.signal.addEventListener("abort", () => {
      this.logger.info("Abort signal received");
      this.stop().catch((e) => {
        this.logger.error("stop() error on abort", { error: e });
      });
    });
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

    for (const network of this.components.networks) {
      const networkInstance = await this.modules.network.createNetwork(network.options);
      this.networks.set(network.name, networkInstance);
    }

    // Allocation is re-used for all demands so the expiration date should
    // be the equal to the longest expiration date of all demands
    const longestExpiration =
      Math.max(...this.components.leaseProcessPools.map((pool) => pool.options.market.rentHours)) * 3600;
    const totalBudget = this.components.leaseProcessPools.reduce(
      (acc, pool) => acc + this.modules.market.estimateBudget(pool.options),
      0,
    );

    const allocation = await this.modules.payment.createAllocation({
      budget: totalBudget,
      expirationSec: longestExpiration,
    });

    for (const pool of this.components.leaseProcessPools) {
      const network = pool.options?.deployment?.network
        ? this.networks.get(pool.options?.deployment.network)
        : undefined;

      const demandSpecification = await this.modules.market.buildDemandDetails(pool.options.demand, allocation);
      const proposalPool = new DraftOfferProposalPool();

      const draftProposal$ = this.modules.market.collectDraftOfferProposals({
        demandSpecification,
        filter: pool.options.market.proposalFilter,
      });

      const proposalSubscription = proposalPool.readFrom(draftProposal$);

      const leaseProcessPool = this.modules.lease.createLeaseProcessPool(proposalPool, allocation, {
        replicas: pool.options.deployment?.replicas,
        network,
        leaseProcessOptions: {
          activity: pool.options?.activity,
          payment: pool.options?.payment,
        },
      });
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

      const stopPools = Array.from(this.pools.values()).map((pool) =>
        Promise.allSettled([pool.proposalSubscription.unsubscribe(), pool.leaseProcessPool.drainAndClear()]),
      );
      await Promise.allSettled(stopPools);

      const stopNetworks: Promise<void>[] = Array.from(this.networks.values()).map((network) =>
        this.modules.network.removeNetwork(network),
      );
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
}
