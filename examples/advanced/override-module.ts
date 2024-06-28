/**
 * In this advanced example, we will provide our own implementation of one of the core modules
 * of the SDK. This example is catered towards library authors who want to extend the SDK's
 * functionality or to advanced users who know what they're doing.
 * It's **very** easy to break things if you don't have a good understanding of the SDK's internals,
 * therefore this feature is not recommended for most users.
 */

import { MarketOrderSpec, GolemNetwork } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

// let's override the `estimateBudget` method from the `MarketModule` interface
// to provide our own implementation
// we need to import the default implementation of the module we want to override
import { MarketModuleImpl } from "@golem-sdk/golem-js";

class MyMarketModule extends MarketModuleImpl {
  estimateBudget({ maxAgreements, order }: { maxAgreements: number; order: MarketOrderSpec }): number {
    // let's take the original estimate and add 20% to it as a buffer
    const originalEstimate = super.estimateBudget({ maxAgreements, order });
    return originalEstimate * 1.2;
  }
}

const order: MarketOrderSpec = {
  demand: {
    workload: { imageTag: "golem/alpine:latest" },
  },
  // based on this order, the "normal" estimateBudget would return 1.5
  // (0.5 start price + 0.5 / hour for CPU + 0.5 / hour for env).
  // Our override should return 1.8 (1.5 * 1.2)
  market: {
    rentHours: 1,
    pricing: {
      model: "linear",
      maxStartPrice: 0.5,
      maxCpuPerHourPrice: 0.5,
      maxEnvPerHourPrice: 0.5,
    },
  },
};

(async () => {
  const glm = new GolemNetwork({
    logger: pinoPrettyLogger({
      level: "info",
    }),
    // here's where we provide our own implementation
    override: {
      market: MyMarketModule,
    },
  });

  // look at the console output to see the budget estimate
  glm.payment.events.on("allocationCreated", (allocation) => {
    console.log("Allocation created with budget:", Number(allocation.remainingAmount).toFixed(2));
  });

  try {
    await glm.connect();
    const rental = await glm.oneOf({ order });
    await rental
      .getExeUnit()
      .then((exe) => exe.run("echo Hello, Golem! 👋"))
      .then((res) => console.log(res.stdout));
    await rental.stopAndFinalize();
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
