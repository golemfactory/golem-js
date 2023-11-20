import { TaskExecutor } from "../../src";
import { LoggerMock } from "../mock";
import fs from "fs";

const logger = new LoggerMock(false);
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

describe("Blender rendering", function () {
  it(
    "should render images by blender",
    async () => {
      const executor = await TaskExecutor.create({
        package: "golem/blender:latest",
        logger,
      });

      executor.beforeEach(async (ctx) => {
        const sourcePath = fs.realpathSync(__dirname + "/../mock/fixtures/cubes.blend");
        await ctx.uploadFile(sourcePath, "/golem/resource/scene.blend");
      });

      const data = [0, 10, 20, 30, 40, 50];

      const futureResults = data.map((frame) =>
        executor.run(async (ctx) => {
          const result = await ctx
            .beginBatch()
            .uploadJson(blenderParams(frame), "/golem/work/params.json")
            .run("/golem/entrypoints/run-blender.sh")
            .downloadFile(`/golem/output/out${frame?.toString().padStart(4, "0")}.png`, `output_${frame}.png`)
            .end()
            .catch((error) => console.error(error.toString()));
          return result ? `output_${frame}.png` : "";
        }),
      );

      const results = await Promise.all(futureResults);
      const expectedResults = data.map((d) => `output_${d}.png`);

      for (const result of results) {
        expect(expectedResults).toContain(result);
      }

      for (const file of expectedResults) {
        expect(fs.existsSync(`${process.env.GOTH_GFTP_VOLUME || ""}${file}`)).toEqual(true);
      }

      await executor.shutdown();
    },
    1000 * 240,
  );
});
