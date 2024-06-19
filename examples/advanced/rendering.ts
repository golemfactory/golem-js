import { MarketOrderSpec, GolemNetwork, LifecycleFunction } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";
import { fileURLToPath } from "url";

const SCENE_FILE_PATH = fileURLToPath(new URL(".", import.meta.url)) + "../../tests/fixtures/cubes.blend";

const blenderParams = (frame) => ({
  scene_file: "/golem/resource/scene.blend",
  resolution: [400, 300],
  use_compositing: false,
  crops: [
    {
      outfilebasename: "out",
      borders_x: [0.0, 1.0],
      borders_y: [0.0, 1.0],
    },
  ],
  samples: 100,
  frames: [frame],
  output_format: "PNG",
  RESOURCES_DIR: "/golem/resources",
  WORK_DIR: "/golem/work",
  OUTPUT_DIR: "/golem/output",
});

const order: MarketOrderSpec = {
  demand: {
    workload: { imageTag: "golem/blender:latest" },
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

    // I want to upload the scene only once on a given machine at startup
    const setup: LifecycleFunction = async (exe) =>
      exe
        .uploadFile(SCENE_FILE_PATH, "/golem/resource/scene.blend")
        .then(() => console.log("Uploaded the scene to the provider %s", exe.provider.name));

    // I want to clean the files after I finish working, but only before destroying the machine
    const teardown: LifecycleFunction = async (exe) =>
      exe
        .run("rm /golem/resource/scene.blend")
        .then(() => console.log("Removed the scene from the provider %s", exe.provider.name));

    const pool = await glm.manyOf({
      concurrency: { min: 1, max: 3 }, // I want to render in parallel on a maximum of 3 machines simultaneously
      order,
      setup,
      teardown,
    });

    const frames = [0, 10, 20, 30, 40, 50];
    await Promise.all(
      frames.map((frame) =>
        pool.withLease((lease) =>
          lease.getExeUnit().then((exe) =>
            exe
              .beginBatch()
              .uploadJson(blenderParams(frame), "/golem/work/params.json")
              .run("/golem/entrypoints/run-blender.sh")
              .downloadFile(`/golem/output/out${frame?.toString().padStart(4, "0")}.png`, `output_${frame}.png`)
              .end()
              .then(() => console.log("Finished rendering of frame %d on provider %s", frame, exe.provider.name)),
          ),
        ),
      ),
    );
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
