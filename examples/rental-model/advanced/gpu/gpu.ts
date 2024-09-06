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
        imageTag: "nvidia/cuda:12.6.0-cudnn-runtime-ubuntu24.04",
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

    // The executable binary from the Samples for CUDA Developers package.
    // This is a simple test program to measure the memcopy bandwidth of the GPU.
    // https://github.com/NVIDIA/cuda-samples
    await exe.uploadFile("./bandwidthTest", "/storage/bandwidthTest");
    await exe.run("chmod +x /storage/bandwidthTest");

    const bandwidthResult = await exe.run("/storage/bandwidthTest");
    console.log("\nCUDA Bandwidth Test:\n\n", bandwidthResult.stdout);

    // Run native command nvidia-smi provided by nvidia driver.
    // https://developer.nvidia.com/system-management-interface
    const nvidiaSmiResult = await exe.run("nvidia-smi");
    console.log("\n\nNVIDIA SMI Test:\n\n", nvidiaSmiResult.stdout);

    await rental.stopAndFinalize();
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
