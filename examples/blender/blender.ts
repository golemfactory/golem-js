import { TaskExecutor } from "@golem-sdk/golem-js";
import { program } from "commander";
import { fileURLToPath } from "url";
const DIR_NAME = fileURLToPath(new URL(".", import.meta.url));

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
async function main(subnetTag: string, driver?: string, network?: string, maxParallelTasks?: number) {
  const executor = await TaskExecutor.create({
    subnetTag,
    payment: { driver, network },
    package: "golem/blender:latest",
    maxParallelTasks,
  });

  try {
    executor.onActivityReady(async (ctx) => {
      await ctx.uploadFile(`${DIR_NAME}/cubes.blend`, "/golem/resource/scene.blend");
    });

    const futureResults = [0, 10, 20, 30, 40, 50].map((frame) =>
      executor.run(async (ctx) => {
        const result = await ctx
          .beginBatch()
          .uploadJson(blenderParams(frame), "/golem/work/params.json")
          .run("/golem/entrypoints/run-blender.sh")
          .downloadFile(`/golem/output/out${frame?.toString().padStart(4, "0")}.png`, `${DIR_NAME}/output_${frame}.png`)
          .end();
        return result?.length ? `output_${frame}.png` : "";
      }),
    );
    const results = await Promise.all(futureResults);
    results.forEach((result) => console.log(result));
  } catch (error) {
    console.error("Computation failed:", error);
  } finally {
    await executor.shutdown();
  }
}

program
  .option("--subnet-tag <subnet>", "set subnet name, for example 'public'")
  .option("--payment-driver, --driver <driver>", "payment driver name, for example 'erc20'")
  .option("--payment-network, --network <network>", "network name, for example 'goerli'")
  .option("-t, --max-parallel-tasks <maxParallelTasks>", "max parallel tasks");
program.parse();
const options = program.opts();
main(options.subnetTag, options.driver, options.network, options.maxParallelTasks);
