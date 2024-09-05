import { GolemNetwork, MarketOrderSpec } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

(async () => {
  const glm = new GolemNetwork({
    logger: pinoPrettyLogger({
      level: "info",
    }),
  });

  const order: MarketOrderSpec = {
    demand: {
      workload: {
        imageHash: "594a2491e578f7ad817d1996bd181b44130d22f3f2db6160214a60b4",
        capabilities: ["!exp:gpu"],
        runtime: {
          name: "vm-nvidia",
        },
      },
    },
    market: {
      rentHours: 0.5,
      pricing: {
        model: "linear",
        maxStartPrice: 0.0,
        maxCpuPerHourPrice: 0.0,
        maxEnvPerHourPrice: 2.0,
      },
    },
  };

  try {
    await glm.connect();
    const rental = await glm.oneOf({ order });
    const exe = await rental.getExeUnit();

    await exe.uploadFile("./bandwidth-test", "/storage/bandwidth-test");
    await exe.run("chmod +x /storage/bandwidth-test");

    console.log((await exe.run("/storage/bandwidth-test")).stdout);

    console.log((await exe.run("nvidia-smi")).stdout);

    await rental.stopAndFinalize();
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
