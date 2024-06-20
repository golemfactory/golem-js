import { GolemConfigError } from "../../shared/error/golem-error";
import { NetworkOptions } from "../../network";
import { Deployment, DeploymentComponents } from "./deployment";
import { GolemNetwork, MarketOrderSpec } from "../../golem-network";
import { validateDeployment } from "./validate-deployment";

export interface DeploymentOptions {
  replicas: number | { min: number; max: number };
  network?: string;
}

export interface CreateResourceRentalPoolOptions extends MarketOrderSpec {
  deployment: DeploymentOptions;
}

export class GolemDeploymentBuilder {
  private components: DeploymentComponents = {
    resourceRentalPools: [],
    networks: [],
  };

  public reset() {
    this.components = {
      resourceRentalPools: [],
      networks: [],
    };
  }

  constructor(private glm: GolemNetwork) {}

  createResourceRentalPool(name: string, options: CreateResourceRentalPoolOptions): this {
    if (this.components.resourceRentalPools.some((pool) => pool.name === name)) {
      throw new GolemConfigError(`Resource Rental Pool with name ${name} already exists`);
    }

    this.components.resourceRentalPools.push({ name, options });

    return this;
  }

  createNetwork(name: string, options: NetworkOptions = {}): this {
    if (this.components.networks.some((network) => network.name === name)) {
      throw new GolemConfigError(`Network with name ${name} already exists`);
    }

    this.components.networks.push({ name, options });

    return this;
  }

  getDeployment(): Deployment {
    validateDeployment(this.components);
    const deployment = new Deployment(this.components, {
      logger: this.glm.services.logger,
      yagna: this.glm.services.yagna,
      payment: this.glm.payment,
      market: this.glm.market,
      activity: this.glm.activity,
      network: this.glm.network,
      rental: this.glm.rental,
    });

    this.reset();

    return deployment;
  }
}
