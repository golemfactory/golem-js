import { Task, Package, Golem, range } from "./todo";
import path from "path";
import { program } from "commander";

const blender_params = (frame) => ({
  scene_file: "/golem/resource/scene.blend",
  resolution: [400, 300],
  use_compositing: false,
  crops: {
    outfilebasename: "out",
    borders_x: [0.0, 1.0],
    borders_y: [0.0, 1.0],
  },
  samples: 100,
  frames: [frame],
  output_format: "PNG",
  RESOURCES_DIR: "/golem/resources",
  WORK_DIR: "/golem/work",
  OUTPUT_DIR: "/golem/output",
});

async function main(subnetTag: string, driver?: string, network?: string) {
  const tasks = range(0, 60, 10).map((frame) => {
    const task = new Task();
    task.sendFile(path.join(__dirname, "./cubes.blend"), "/golem/resource/scene.blend");
    task.sendJson("/golem/work/params.json", blender_params(frame));
    task.run("/golem/entrypoints/run-blender.sh");
    task.downloadFile(
      `/golem/output/out${frame.toString().padStart(4, "0")}.png`,
      path.join(__dirname, `./output_${frame}.png`)
    );
    return task;
  });

  const _package = new Package({
    image_hash: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
    min_mem_gib: 0.5,
    min_storage_gib: 2.0,
  });
  const golem = new Golem({
    package: _package,
    max_workers: 6,
    timeout: 15 * 60 * 1000,
    budget: "10.0",
    subnet_tag: subnetTag,
    driver: driver,
    network: network,
  });

  // prepare ...
  await golem.init();

  // create and interact with activity
  const results = await golem.run(tasks);

  results.on("data", async (result) => {
    console.log(`Task: ${result.task_id}, Provider: ${result.provider_id}, Stdout: ${result.stdout}`);
    await golem.acceptTaskResult(result.task_id);
    // or
    await result.accept();
  });

  results.on("end", async () => {
    console.log("All frames rendered");
    await golem.end();
  });
}

program
  .option("--subnet-tag <subnet>", "set subnet name, for example 'devnet-beta'")
  .option("--payment-driver, --driver <driver>", "payment driver name, for example 'erc20'")
  .option("--payment-network, --network <network>", "network name, for example 'rinkeby'")
  .option("-d, --debug", "output extra debugging");
program.parse();
const options = program.opts();
main(options.subnetTag, options.driver, options.network);
