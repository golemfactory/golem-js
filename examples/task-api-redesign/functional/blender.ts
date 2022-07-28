import { Task, Package, Golem, range } from "./todo";

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

  await golem.beforeEach(async (ctx) => {
    await ctx.sendFile("./cubes.blend", "/golem/resource/scene.blend");
  });

  const results = await golem.map(range(0, 60, 10), async (ctx, frame) => {
    const result = await ctx
      .beginBatch()
      .sendJson("/golem/work/params.json", blender_params(frame))
      .run("/golem/entrypoints/run-blender.sh")
      .download_file(`/golem/output/out${frame.toString().padStart(4, "0")}.png`, `./output_${frame}.png`)
      .end();
    console.log(`result=${result.stdout}`);
    ctx.accept_result(result);
    return result.stdout;
  });

  console.log("All frames rendered: " + results.join(", "));
  await golem.end();
}

main();
