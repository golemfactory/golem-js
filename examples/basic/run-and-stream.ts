import { MarketOrderSpec, GolemNetwork } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

/**
 * Example demonstrating the execution of a command on a provider which may take a long time
 * and returns the results from the execution during the command as a stream
 */

const order: MarketOrderSpec = {
  demand: {
    workload: { imageTag: "golem/alpine:latest" },
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
};

(async () => {
  const glm = new GolemNetwork({
    logger: pinoPrettyLogger({
      level: "info",
    }),
  });

  try {
    await glm.connect();
    const lease = await glm.oneOf(order);
    const exe = await lease.getExeUnit();

    const remoteProcess = await exe.runAndStream("sleep 1 && echo 'Hello World' && echo 'Hello Golem' >&2");
    remoteProcess.stdout.on("data", (data) => console.log("stdout>", data));
    remoteProcess.stderr.on("data", (data) => console.error("stderr>", data));
    await remoteProcess.waitForExit();

    await lease.finalize();
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
