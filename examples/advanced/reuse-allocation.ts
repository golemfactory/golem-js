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

    const lease1 = await glm.oneOf({ order: firstOrder });
    const lease2 = await glm.oneOf({ order: secondOrder });

    await lease1
      .getExeUnit()
      .then((exe) => exe.run("echo Running on first lease"))
      .then((res) => console.log(res.stdout));
    await lease2
      .getExeUnit()
      .then((exe) => exe.run("echo Running on second lease"))
      .then((res) => console.log(res.stdout));

    await lease1.finalize();
    await lease2.finalize();
    await glm.payment.releaseAllocation(allocation);
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
