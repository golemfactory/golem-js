import { TaskExecutor } from "@golem-sdk/golem-js";
import { program } from "commander";
import { fileURLToPath } from "url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));

const blender_params = (frame) => ({
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

async function main(subnetTag: string, driver?: string, network?: string, debug?: boolean, maxParallelTasks?: number) {
  const executor = await TaskExecutor.create({
    subnetTag,
    payment: { driver, network },
    package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
    logLevel: debug ? "debug" : "info",
    maxParallelTasks,
  });

  executor.beforeEach(async (ctx) => {
    await ctx.uploadFile(`${__dirname}/cubes.blend`, "/golem/resource/scene.blend");
  });

  const results = executor.map<number, string>([0, 10, 20, 30, 40, 50], async (ctx, frame) => {
    const result = await ctx
      .beginBatch()
      .uploadJson(blender_params(frame), "/golem/work/params.json")
      .run("/golem/entrypoints/run-blender.sh")
      .downloadFile(`/golem/output/out${frame?.toString().padStart(4, "0")}.png`, `${__dirname}/output_${frame}.png`)
      .end()
      .catch((e) => console.error(e));
    return result?.length ? `output_${frame}.png` : "";
  });
  for await (const result of results) console.log(result);
  await executor.end();
}

program
  .option("--subnet-tag <subnet>", "set subnet name, for example 'public'")
  .option("--payment-driver, --driver <driver>", "payment driver name, for example 'erc20'")
  .option("--payment-network, --network <network>", "network name, for example 'goerli'")
  .option("-d, --debug", "output extra debugging")
  .option("-t, --max-parallel-tasks <maxParallelTasks>", "max parallel tasks");
program.parse();
const options = program.opts();
main(options.subnetTag, options.driver, options.network, options.debug, options.maxParallelTasks);
