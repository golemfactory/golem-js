import { GolemConfigError } from "../../error/golem-error";
import { DeploymentComponents } from "./deployment";

function validateNetworks(components: DeploymentComponents) {
  const networkNames = new Set(components.networks.map((network) => network.name));
  for (const pool of components.activityPools) {
    if (!pool.options.network) {
      continue;
    }
    if (!networkNames.has(pool.options.network)) {
      throw new GolemConfigError(`Activity pool ${pool.name} references non-existing network ${pool.options.network}`);
    }
  }
}

export function validateDeployment(components: DeploymentComponents) {
  validateNetworks(components);
  // ... other validations
}
