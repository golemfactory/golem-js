import { GolemNetwork } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

(async () => {
  const glm = new GolemNetwork({
    logger: pinoPrettyLogger({
      level: "debug",
    }),
  });

  try {
    await glm.connect();

    const lease = await glm.oneOf({
      demand: {
        imageTag: "golem/alpine:latest",
        minCpuCores: 4,
        minMemGib: 8,
        minStorageGib: 16,
      },
      market: {
        rentHours: 12,
        pricing: {
          maxStartPrice: 1,
          maxCpuPerHourPrice: 1,
          maxEnvPerHourPrice: 1,
        },
      },
      payment: {
        driver: "erc20",
        network: "holesky",
      },
    });

    const exe = await lease.getExeUnit();

    const result = await exe.run("echo 'Hello World!'");
    console.log(result.stdout);

    // Wait for the lease to be fully terminated and settled
    await lease.finalize();
  } catch (err) {
    console.error("Failed to run the example", err);
  }

  await glm.disconnect();
})().catch(console.error);
