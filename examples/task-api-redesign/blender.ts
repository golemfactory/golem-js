import { Golem, utils } from "../../dist";
import path from "path";
// utils.changeLogLevel("debug");

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

async function main() {
  const golem = new Golem("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
  await golem.init();

  golem.beforeEach(async (ctx) => {
    await ctx.uploadFile(path.join(__dirname, "./cubes.blend"), "/golem/resource/scene.blend");
  });

  const results = await golem.map(utils.range(0, 60, 10), async (ctx, frame) => {
    const results = await ctx
      .beginBatch()
      .uploadJson(blender_params(frame), "/golem/work/params.json")
      .run("/golem/entrypoints/run-blender.sh")
      .downloadFile(
        `/golem/output/out${frame.toString().padStart(4, "0")}.png`,
        path.join(__dirname, `./output_${frame}.png`)
      )
      .end();
    const error = results.find((res) => res.result === "Error");
    if (error) {
      ctx.rejectResult();
      return null;
    }
    return `output_${frame}.png`;
  });
  for await (const result of results) {
    console.log(result);
  }
  await golem.end();
}

main();
