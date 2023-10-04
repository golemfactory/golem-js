/**
 * Helps to obtain a whitelist of providers which were health-tested.
 *
 * Important: This helper requires internet access to function properly.
 *
 * @return An array with Golem Node IDs of the whitelisted providers. In case of any issues, it will return an empty whitelist.
 */
export async function getHealthyProvidersWhiteList(): Promise<string[]> {
  try {
    const response = await fetch("https://provider-health.golem.network/v1/provider-whitelist");

    if (response.ok) {
      return response.json();
    } else {
      const body = await response.text();
      console.error("Request to download healthy provider whitelist failed.", body);

      return [];
    }
  } catch (err) {
    console.error("Failed to download healthy provider whitelist due to an error", err);

    return [];
  }
}
