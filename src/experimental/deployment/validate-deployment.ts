import { GolemConfigError } from "../../shared/error/golem-error";
import { DeploymentComponents } from "./deployment";

function validateNetworks(components: DeploymentComponents) {
  const networkNames = new Set(components.networks.map((network) => network.name));
  for (const pool of components.leaseProcessPools) {
    if (!pool.options.deployment?.network) {
      continue;
    }
    if (!networkNames.has(pool.options.deployment.network)) {
      throw new GolemConfigError(
        `Activity pool ${pool.name} references non-existing network ${pool.options.deployment.network}`,
      );
    }
  }
}

export function validateDeployment(components: DeploymentComponents) {
  validateNetworks(components);
  // ... other validations
}
