import { GolemConfigError } from "../../shared/error/golem-error";
import { NetworkOptions } from "../../network";
import { Deployment, DeploymentComponents } from "./deployment";
import { GolemNetwork } from "../../golem-network";
import { validateDeployment } from "./validate-deployment";
import { ActivityPoolOptions } from "../../activity/work/pool";

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

  createActivityPool(name: string, options: ActivityPoolOptions): this {
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
