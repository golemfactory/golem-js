import { GolemConfigError } from "../../shared/error/golem-error";
import { NetworkOptions } from "../../network";
import { Deployment, DeploymentComponents } from "./deployment";
import { GolemNetwork } from "../../golem-network";
import { validateDeployment } from "./validate-deployment";
import { MarketOptions } from "../../market";
import { PaymentModuleOptions } from "../../payment";
import { DemandOptionsNew } from "../../market/demand";

interface DeploymentOptions {
  replicas?: number | { min: number; max: number };
  network?: string;
}

export interface CreateActivityPoolOptions {
  demand: DemandOptionsNew;
  market: MarketOptions;
  deployment?: DeploymentOptions;
  payment?: PaymentModuleOptions;
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
    const deployment = new Deployment(
      this.components,
      {
        logger: this.glm.services.logger,
        yagna: this.glm.services.yagna,
        payment: this.glm.payment,
        market: this.glm.market,
        activity: this.glm.activity,
      },
      {
        dataTransferProtocol: this.glm.options.dataTransferProtocol ?? "gftp",
      },
    );

    this.reset();

    return deployment;
  }
}
