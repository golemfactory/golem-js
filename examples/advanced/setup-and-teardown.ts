import { MarketOrderSpec, GolemNetwork, LifecycleFunction } from "@golem-sdk/golem-js";
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

    const setup: LifecycleFunction = async (exe) =>
      exe
        .run(`echo This code is run on the start of the exe-unit ${exe.provider.name}`)
        .then((res) => console.log(res.stdout));

    const teardown: LifecycleFunction = async (exe) =>
      exe
        .run(`echo This code is run before the exe-unit ${exe.provider.name} is destroyed`)
        .then((res) => console.log(res.stdout));

    const pool = await glm.manyOf({
      concurrency: 3,
      order,
      setup,
      teardown,
    });
    await Promise.allSettled([
      pool.withLease(async (lease) =>
        lease
          .getExeUnit()
          .then((exe) => exe.run(`echo Hello, Golem from the first machine! 👋 ${exe.provider.name}`))
          .then((res) => console.log(res.stdout)),
      ),
      pool.withLease(async (lease) =>
        lease
          .getExeUnit()
          .then((exe) => exe.run(`echo Hello, Golem from the second machine! 👋 ${exe.provider.name}`))
          .then((res) => console.log(res.stdout)),
      ),
    ]);
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
