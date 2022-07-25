import { Task, Golem, range } from "./todo";

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

async function main() {
  const golem = new Golem("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");

  const init_task = new Task().sendFile("./cubes.blend", "/golem/resource/scene.blend");
  await golem.init([init_task]);

  const tasks = range(0, 60, 10).map((frame) =>
    new Task()
      .sendJson("/golem/work/params.json", blender_params(frame))
      .run("/golem/entrypoints/run-blender.sh")
      .downloadFile(`/golem/output/out${frame.toString().padStart(4, "0")}.png`, `./output_${frame}.png`)
  );

  const results = await golem.run(tasks);

  results.on("data", async (result) => {
    console.log(`Task: ${result.task_id}, Provider: ${result.provider_id}, Stdout: ${result.stdout}`);
    await result.accept();
  });

  results.on("end", async () => {
    console.log("All frames rendered");
    await golem.end();
  });
}

main();
