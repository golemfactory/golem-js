/**
 * Whitelist Outbound Internet Access Example
 *
 * This example presents how you can leverage the whitelist outbound rule.
 *
 * Few things to keep in mind:
 *
 * - your Requestor script has to present a manifest (manifest.json) as part of the demand when negotiating
 *   with Providers
 * - the Providers need to have the URL which you're trying to reach on their whitelist, if the address
 *   which you're using is not on the pre-installed one (which the providers can clear if they want to)
 *   then you need to reach out to the Provider community (you can use Golem Network's Discord) and
 *   request opening some URL by them for you :
 *
 * @link https://github.com/golemfactory/ya-installer-resources/tree/main/whitelist Pre-installed whitelist
 *
 * For the purpose of this example, a special group of machines (providers) has been launched
 * that operate in the subnet named `satori` and have a predefined whitelist containing the domain tcpbin.com.
 *
 *
 * WORKING WITH THE MANIFEST
 *
 * `@golem-sdk/cli` to the rescue - check the `manifest` sub-command to generate the manifest for your
 * requestor and maintain the outbound configuration
 *
 */
import { GolemNetwork } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

const dirName = path.dirname(fileURLToPath(import.meta.url));

(async () => {
  const logger = pinoPrettyLogger({
    level: "debug",
  });

  const glm = new GolemNetwork({
    logger,
  });

  try {
    await glm.connect();

    /**
     * Used to terminate the script after 120s in any case
     *
     * It's possible that no provider will be accepting your offer due to not having the base URL
     * which you are trying to reach on their whitelist, or they don't allow whitelist outbound
     * access at all.
     */
    const timeoutSignal = AbortSignal.timeout(120_000);
    const onTimeout = () => console.log("Reached timeout, no one wanted to collaborate");
    timeoutSignal.addEventListener("abort", onTimeout);

    const rental = await glm.oneOf({
      order: {
        demand: {
          subnetTag: "satori",
          workload: {
            manifest: fs.readFileSync(path.join(dirName, "manifest.json")).toString("base64"),
          },
        },
        market: {
          rentHours: 0.5,
          pricing: {
            model: "linear",
            maxStartPrice: 0.5,
            maxCpuPerHourPrice: 1.0,
            maxEnvPerHourPrice: 0.5,
          },
        },
      },
      signalOrTimeout: timeoutSignal,
    });

    timeoutSignal.removeEventListener("abort", onTimeout);

    const exe = await rental.getExeUnit();

    // The following command will be executed by the Provider:
    // It sends "Hello via tcp" to the tcpbin.com service on port 4242 using the TCP protocol.
    // Provider will receive the response back from the tcpbin.com service.
    const result = await exe.run("echo 'Hello via tcp' | nc tcpbin.com 4242");
    console.log("Results:", result);

    await rental.stopAndFinalize();
  } catch (err) {
    console.error(err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
