/**
 * This example demonstrates how easily rent multiple machines at once.
 */

import { GolemNetwork, MarketOrderSpec } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

const order: MarketOrderSpec = {
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
  });

  try {
    await glm.connect();
    // create a pool that can grow up to 3 rentals at the same time
    const pool = await glm.manyOf({
      concurrency: 3,
      order,
    });
    await Promise.allSettled([
      pool.withRental(async (rental) =>
        rental
          .getExeUnit()
          .then((exe) => exe.run("echo Hello, Golem from the first machine! 👋"))
          .then((res) => console.log(res.stdout)),
      ),
      pool.withRental(async (rental) =>
        rental
          .getExeUnit()
          .then((exe) => exe.run("echo Hello, Golem from the second machine! 👋"))
          .then((res) => console.log(res.stdout)),
      ),
      pool.withRental(async (rental) =>
        rental
          .getExeUnit()
          .then((exe) => exe.run("echo Hello, Golem from the third machine! 👋"))
          .then((res) => console.log(res.stdout)),
      ),
    ]);
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
