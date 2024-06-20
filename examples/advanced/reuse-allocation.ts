/**
 * This advanced example demonstrates create an allocation manually and then reuse
 * it across multiple market orders.
 */
import { MarketOrderSpec, GolemNetwork } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";
(async () => {
  const glm = new GolemNetwork({
    logger: pinoPrettyLogger({
      level: "info",
    }),
  });

  try {
    await glm.connect();

    const allocation = await glm.payment.createAllocation({
      budget: 1,
      expirationSec: 3600,
    });

    const firstOrder: MarketOrderSpec = {
      demand: {
        workload: { imageTag: "golem/alpine:latest" },
      },
      market: {
        rentHours: 0.5,
        pricing: {
          model: "burn-rate",
          avgGlmPerHour: 0.5,
        },
      },
      payment: {
        // You can either pass the allocation object ...
        allocation,
      },
    };
    const secondOrder: MarketOrderSpec = {
      demand: {
        workload: { imageTag: "golem/alpine:latest" },
      },
      market: {
        rentHours: 0.5,
        pricing: {
          model: "burn-rate",
          avgGlmPerHour: 0.5,
        },
      },
      payment: {
        // ... or just the allocation ID
        allocation: allocation.id,
      },
    };

    const rental1 = await glm.oneOf({ order: firstOrder });
    const rental2 = await glm.oneOf({ order: secondOrder });

    await rental1
      .getExeUnit()
      .then((exe) => exe.run("echo Running on first rental"))
      .then((res) => console.log(res.stdout));
    await rental2
      .getExeUnit()
      .then((exe) => exe.run("echo Running on second rental"))
      .then((res) => console.log(res.stdout));

    await rental1.stopAndFinalize();
    await rental2.stopAndFinalize();
    await glm.payment.releaseAllocation(allocation);
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
