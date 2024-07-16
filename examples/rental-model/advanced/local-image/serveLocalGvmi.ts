/**
 * This example demonstrates how to upload a local GVMI file to the provider.
 * Take a look at the `Dockerfile` in the same directory to see what's inside the image.
 */
import { GolemNetwork, MarketOrderSpec } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

// get the absolute path to the local image in case this file is run from a different directory
const getImagePath = (path: string) => new URL(path, import.meta.url).toString();

(async () => {
  const logger = pinoPrettyLogger({
    level: "debug",
  });

  const glm = new GolemNetwork({
    logger,
  });

  try {
    await glm.connect();

    const order: MarketOrderSpec = {
      demand: {
        workload: {
          // if the image url starts with "file://" it will be treated as a local file
          // and the sdk will automatically serve it to the provider
          imageUrl: getImagePath("./alpine.gvmi"),
        },
      },
      market: {
        rentHours: 5 / 60,
        pricing: {
          model: "linear",
          maxStartPrice: 1,
          maxCpuPerHourPrice: 1,
          maxEnvPerHourPrice: 1,
        },
      },
    };

    const rental = await glm.oneOf({ order });
    // in our Dockerfile we have created a file called hello.txt, let's read it
    const result = await rental
      .getExeUnit()
      .then((exe) => exe.run("cat hello.txt"))
      .then((res) => res.stdout);
    console.log(result);
  } catch (err) {
    console.error("Failed to run example on Golem", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
