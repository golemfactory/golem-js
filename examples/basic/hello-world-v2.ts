import { DemandSpec, GolemNetwork } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

const demandOptions: DemandSpec = {
  demand: {
    activity: { imageTag: "golem/alpine:latest" },
  },
  market: {
    maxAgreements: 1,
    rentHours: 0.5,
    pricing: {
      model: "linear",
      maxStartPrice: 0.5,
      maxCpuPerHourPrice: 1.0,
      maxEnvPerHourPrice: 0.5,
    },
  },
  payment: {
    driver: "erc20",
    network: "holesky",
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
    const lease = await glm.oneOf(demandOptions);
    await lease
      .getExeUnit()
      .then((exe) => exe.run("echo Hello, Golem! 👋"))
      .then((res) => console.log(res.stdout));
    await lease.finalize();
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
