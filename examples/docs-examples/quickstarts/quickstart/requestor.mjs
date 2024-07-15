/**
 * This example demonstrates how easily lease multiple machines at once.
 */

import { GolemNetwork } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

const order = {
  demand: {
    workload: { imageTag: "golem/alpine:latest" },
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
};

(async () => {
  const glm = new GolemNetwork({
    logger: pinoPrettyLogger({
      level: "info",
    }),
    api: { key: "try_golem" },
  });

  try {
    await glm.connect();
    const pool = await glm.manyOf({
      // I want to have a minimum of one machine in the pool,
      // but only a maximum of 3 machines can work at the same time
      poolSize: { min: 1, max: 3 },
      order,
    });
    // I have 5 parts of the task to perform in parallel
    const data = [...Array(5).keys()];
    const results = await Promise.allSettled(
      data.map((i) =>
        pool.withRental((rental) =>
          rental
            .getExeUnit()
            .then((exe) =>
              exe.run(
                `echo "Part #${i} computed on provider ${exe.provider.name} with CPU:" && cat /proc/cpuinfo | grep 'model name'`,
              ),
            ),
        ),
      ),
    );
    results.forEach((result) => {
      if (result.status === "fulfilled") {
        console.log("Success:", result.value.stdout);
      } else {
        console.log("Failure:", result.reason);
      }
    });
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
