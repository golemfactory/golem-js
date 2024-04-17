import { GolemConfigError } from "../../shared/error/golem-error";
import { NetworkOptions } from "../../network";
import { Deployment, DeploymentComponents } from "./deployment";
import { GolemNetwork } from "../../golem-network";
import { validateDeployment } from "./validate-deployment";
import { DemandOptions, MarketOptions } from "../../market";
import { PaymentOptions } from "../../payment";

interface DeploymentOptions {
  replicas?: number | { min: number; max: number };
  network?: string;
}

export interface CreateActivityPoolOptions {
  demand: DemandOptions;
  market: MarketOptions;
  deployment?: DeploymentOptions;
  payment?: PaymentOptions;
}

export class GolemDeploymentBuilder {
  private components: DeploymentComponents = {
    activityPools: [],
    networks: [],
  };

  public reset() {
    this.components = {
      activityPools: [],
      networks: [],
    };
  }

  constructor(private glm: GolemNetwork) {}

  createActivityPool(name: string, options: CreateActivityPoolOptions): this {
    if (this.components.activityPools.some((pool) => pool.name === name)) {
      throw new GolemConfigError(`Activity pool with name ${name} already exists`);
    }

    this.components.activityPools.push({ name, options });

    return this;
  }

  createNetwork(name: string, options: NetworkOptions): this {
    if (this.components.networks.some((network) => network.name === name)) {
      throw new GolemConfigError(`Network with name ${name} already exists`);
    }

    this.components.networks.push({ name, options });

    return this;
  }

  getDeployment(): Deployment {
    validateDeployment(this.components);
    const deployment = new Deployment(this.components, {
      ...this.glm.options,
    });

    this.reset();

    return deployment;
  }
}
