import { GolemError } from "../error/golem-error";

/**
 * Helps to obtain a whitelist of providers which were health-tested.
 *
 * Important: This helper requires internet access to function properly.
 *
 * @return An array with Golem Node IDs of the whitelisted providers.
 */
export async function getHealthyProvidersWhiteList(): Promise<string[]> {
  try {
    const response = await fetch("https://provider-health.golem.network/v1/provider-whitelist");

    if (response.ok) {
      return response.json();
    } else {
      const body = await response.text();

      throw new GolemError(`Request to download healthy provider whitelist failed: ${body}`);
    }
  } catch (err) {
    throw new GolemError(`Failed to download healthy provider whitelist due to an error: ${err}`);
  }
}
