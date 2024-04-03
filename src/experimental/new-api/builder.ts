import { Deployment } from "./deployment";
import { ActivityPoolOptions, NetworkOptions } from "./types";

export class GolemDeploymentBuilder {
  createActivityPool(name: string, options: ActivityPoolOptions): this {
    throw new Error(`TODO, ${name}, ${options}`);
    // TODO
    return this;
  }
  createNetwork(name: string, options: NetworkOptions): this {
    throw new Error(`TODO, ${name}, ${options}`);
    // TODO
    return this;
  }

  getDeployment(): Deployment {
    throw new Error("TODO");
  }
}
