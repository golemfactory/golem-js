import { GolemDeploymentBuilder } from "./builder";

export interface GolemNetworkOptions {
  // todo
}

export class GolemNetworkNew {
  constructor(private readonly options: GolemNetworkOptions) {}

  async connect() {
    // todo
  }

  async disconnect() {
    // todo
  }

  createBuilder(): GolemDeploymentBuilder {
    throw new Error("TODO");
  }
}
