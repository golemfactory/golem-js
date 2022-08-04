import { Golem, utils } from "../../dist";

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

  const results = await golem.map(utils.range(0, 60, 10), async (ctx, frame) => {
    const result = await ctx
      .beginBatch()
      .sendJson("/golem/work/params.json", blender_params(frame))
      .run("/golem/entrypoints/run-blender.sh")
      .downloadFile(`/golem/output/out${frame.toString().padStart(4, "0")}.png`, `./output_${frame}.png`)
      .end();
    ctx.acceptResult(result);
    return result.stdout;
  });

  for await (const result of results) {
    console.log(`result=${result}`);
  }
  await golem.end();
}

main();
