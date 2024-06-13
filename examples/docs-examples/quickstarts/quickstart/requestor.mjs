/**
 * This example demonstrates how easily lease multiple machines at once.
 */

import { GolemNetwork } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";
import { randomInt } from "node:crypto";

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
    // api: { key: "try_golem" }
  });

  try {
    await glm.connect();
    const pool = await glm.manyOf({
      concurrency: { min: 1, max: 3 },
      order,
    });
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const results = await Promise.allSettled(
      data.map((item) =>
        pool.withLease((lease) =>
          lease.getExeUnit().then((exe) => exe.run(`echo ${item} from provider ${exe.provider.name}`)),
        ),
      ),
    );
    results.forEach((result) => {
      if (result.status === "fulfilled") {
        console.log("Success", result.value.stdout);
      } else {
        console.log("Failure", result.reason);
      }
    });
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
