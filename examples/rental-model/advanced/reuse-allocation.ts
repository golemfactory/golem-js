/**
 * This advanced example demonstrates create an allocation manually and then reuse
 * it across multiple market orders.
 */
import { MarketOrderSpec, GolemNetwork } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

(async () => {
  const ALLOCATION_DURATION_HOURS = 1;
  const RENTAL_DURATION_HOURS = 0.5;

  console.assert(
    ALLOCATION_DURATION_HOURS > RENTAL_DURATION_HOURS,
    "Always create allocations that will live longer than the planned rental duration",
  );

  const glm = new GolemNetwork({
    logger: pinoPrettyLogger({
      level: "debug",
    }),
  });

  try {
    await glm.connect();

    const allocation = await glm.payment.createAllocation({
      budget: 1,
      expirationSec: ALLOCATION_DURATION_HOURS * 60 * 60,
    });

    const firstOrder: MarketOrderSpec = {
      demand: {
        workload: { imageTag: "golem/alpine:latest" },
      },
      market: {
        rentHours: RENTAL_DURATION_HOURS,
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
        rentHours: RENTAL_DURATION_HOURS,
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
