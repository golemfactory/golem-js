import { GolemDeploymentBuilder } from "./builder";
import { DeploymentOptions } from "./deployment";

export interface GolemNetworkOptions extends DeploymentOptions {}

export class GolemNetworkNew {
  constructor(public readonly options: GolemNetworkOptions) {}

  async connect() {
    // todo
  }

  async disconnect() {
    // todo
  }

  createBuilder(): GolemDeploymentBuilder {
    return new GolemDeploymentBuilder(this);
  }
}
