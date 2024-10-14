import { GolemAbortError, GolemUserError } from "../../shared/error/golem-error";
import { defaultLogger, Logger, YagnaApi } from "../../shared/utils";
import { EventEmitter } from "eventemitter3";
import { ActivityModule } from "../../activity";
import { Network, NetworkModule, NetworkOptions } from "../../network";
import { validateDeployment } from "./validate-deployment";
import { DraftOfferProposalPool, MarketModule } from "../../market";
import { PaymentModule } from "../../payment";
import { CreateResourceRentalPoolOptions } from "./builder";
import { Subscription } from "rxjs";
import { RentalModule, ResourceRentalPool } from "../../resource-rental";

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
  resourceRentalPools: { name: string; options: CreateResourceRentalPoolOptions }[];
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
      resourceRentalPool: ResourceRentalPool;
    }
  >();

  private readonly networks = new Map<string, Network>();

  private readonly modules: {
    market: MarketModule;
    activity: ActivityModule;
    payment: PaymentModule;
    network: NetworkModule;
    rental: RentalModule;
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
      rental: RentalModule;
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
      Math.max(...this.components.resourceRentalPools.map((pool) => pool.options.market.rentHours)) * 3600;

    const totalBudget = this.components.resourceRentalPools.reduce((acc, pool) => {
      const replicas = pool.options.deployment.replicas;
      const maxAgreements = typeof replicas === "number" ? replicas : (replicas?.max ?? replicas?.min ?? 1);
      return (
        acc +
        this.modules.market.estimateBudget({
          order: pool.options,
          maxAgreements,
        })
      );
    }, 0);

    const allocation = await this.modules.payment.createAllocation({
      budget: totalBudget,
      expirationSec: longestExpiration,
    });

    for (const pool of this.components.resourceRentalPools) {
      const network = pool.options?.deployment?.network
        ? this.networks.get(pool.options?.deployment.network)
        : undefined;

      const demandSpecification = await this.modules.market.buildDemandDetails(
        pool.options.demand,
        pool.options.market,
        allocation,
      );

      const proposalPool = new DraftOfferProposalPool({
        logger: this.logger,
        validateOfferProposal: pool.options.market.offerProposalFilter,
        selectOfferProposal: pool.options.market.offerProposalSelector,
      });

      const draftProposal$ = this.modules.market.collectDraftOfferProposals({
        demandSpecification,
        pricing: pool.options.market.pricing,
        filter: pool.options.market.offerProposalFilter,
      });

      const proposalSubscription = proposalPool.readFrom(draftProposal$);

      const resourceRentalPool = this.modules.rental.createResourceRentalPool(proposalPool, allocation, {
        poolSize: pool.options.deployment?.replicas,
        network,
        resourceRentalOptions: {
          activity: pool.options?.activity,
          payment: pool.options?.payment,
        },
        agreementOptions: {
          expirationSec: pool.options.market.rentHours * 3600,
        },
      });
      this.pools.set(pool.name, {
        proposalPool,
        proposalSubscription,
        resourceRentalPool,
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
        Promise.allSettled([pool.proposalSubscription.unsubscribe(), pool.resourceRentalPool.drainAndClear()]),
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

  getResourceRentalPool(name: string): ResourceRentalPool {
    const pool = this.pools.get(name);
    if (!pool) {
      throw new GolemUserError(`ResourceRentalPool ${name} not found`);
    }
    return pool.resourceRentalPool;
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
    const readyPools = [...this.pools.values()].map((component) => component.resourceRentalPool.ready());
    await Promise.all(readyPools);
    this.logger.info("Components deployed and ready to use");
  }
}
