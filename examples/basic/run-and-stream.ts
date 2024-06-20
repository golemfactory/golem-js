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
    const rental = await glm.oneOf(order);
    const exe = await rental.getExeUnit();

    const remoteProcess = await exe.runAndStream(
      `
      sleep 1
      echo -n 'Hello from stdout' >&1
      echo -n 'Hello from stderr' >&2
      sleep 1
      echo -n 'Hello from stdout again' >&1
      echo -n 'Hello from stderr again' >&2
      sleep 1
      echo -n 'Hello from stdout yet again' >&1
      echo -n 'Hello from stderr yet again' >&2
      `,
    );
    remoteProcess.stdout.on("data", (data) => console.log("stdout>", data));
    remoteProcess.stderr.on("data", (data) => console.error("stderr>", data));
    await remoteProcess.waitForExit();

    await rental.stopAndFinalize();
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
