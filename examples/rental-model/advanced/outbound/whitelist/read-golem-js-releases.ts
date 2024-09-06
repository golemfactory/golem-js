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
 * This example reaches out to the whitelisted registry.npmjs.org to download golem-js release information
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
    /**
     * Used to terminate the script after 60s in any case
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
          workload: {
            imageTag: "golem/node:latest",
            manifest: fs.readFileSync(path.join(dirName, "manifest.json")).toString("base64"),
          },
        },
        market: {
          rentHours: 15 / 60,
          pricing: {
            model: "burn-rate",
            avgGlmPerHour: 1,
          },
        },
      },
      signalOrTimeout: timeoutSignal,
    });

    timeoutSignal.removeEventListener("abort", onTimeout);

    const exe = await rental.getExeUnit();
    console.log(await exe.run("curl https://registry.npmjs.org/-/package/@golem-sdk/golem-js/dist-tags"));

    await rental.stopAndFinalize();
  } catch (err) {
    console.error(err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
