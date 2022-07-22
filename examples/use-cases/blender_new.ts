import { Task, Package, Golem, range } from "./todo";
import path from "path";

async function main() {
  const tasks: Task[] = [];
  range(0, 60, 10).forEach((frame) => {
    const task = new Task();
    task.sendFile(path.join(__dirname, "./cubes.blend"), "/golem/resource/scene.blend");
    task.sendJson("/golem/work/params.json", {
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
    task.run("/golem/entrypoints/run-blender.sh");
    task.downloadFile(
      `/golem/output/out${frame.toString().padStart(4, "0")}.png`,
      path.join(__dirname, `./output_${frame}.png`)
    );
    tasks.push(task);
  });

  const task_package = new Package({
    image_hash: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
    min_mem_gib: 0.5,
    min_storage_gib: 2.0,
  });
  const golem = new Golem({
    package: task_package,
    tasks,
  });
  const results = await golem.run();

  results.on("data", async (result) => {
    console.log(`Task: ${result.task_id}, Provider: ${result.provider_id}, Stdout: ${result.stdout}`);
    await golem.acceptTaskResult(result.task_id);
  });
}
