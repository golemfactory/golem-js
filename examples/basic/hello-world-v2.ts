import { GolemNetwork } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

(async () => {
  const glm = new GolemNetwork({
    logger: pinoPrettyLogger(),
  });

  try {
    await glm.connect();

    const lease = await glm.oneOf({
      demand: {
        image: "golem/alpine:latest",
        resources: {
          minCpu: 4,
          minMemGib: 8,
          minStorageGib: 16,
        },
      },
      market: {
        rentHours: 12,
        pricing: {
          maxStartPrice: 1,
          maxCpuPerHourPrice: 1,
          maxEnvPerHourPrice: 1,
        },
      },
    });

    const exe = await lease.getExeUnit();

    const result = await exe.run("echo 'Hello World!'");
    console.log(result.stdout);

    // Be nice
    await lease.terminate();
    await lease.finalized();
  } catch (err) {
    console.error("Failed to run the example", err);
  }

  await glm.disconnect();
})().catch(console.error);
