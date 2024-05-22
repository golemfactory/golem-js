import { DemandSpec, GolemNetwork } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

const demandOptions: DemandSpec = {
  demand: {
    activity: { imageTag: "golem/alpine:latest" },
  },
  market: {
    maxAgreements: 2,
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
    const network = await glm.createNetwork({ ip: "192.168.7.0/24" });
    const lease1 = await glm.oneOf(demandOptions, { network });
    const lease2 = await glm.oneOf(demandOptions, { network });
    const exe1 = await lease1.getExeUnit();
    const exe2 = await lease2.getExeUnit();
    await exe1
      .run(`ping ${exe2.getIp()} -c 4`)
      .then((res) => console.log(`Response from provider: ${exe1.provider.name} (ip: ${exe1.getIp()})`, res.stdout));
    await exe2
      .run(`ping ${exe1.getIp()} -c 4`)
      .then((res) => console.log(`Response from provider: ${exe2.provider.name} (ip: ${exe2.getIp()})`, res.stdout));
    await lease1.finalize();
    await lease2.finalize();
    await glm.destroyNetwork(network);
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
