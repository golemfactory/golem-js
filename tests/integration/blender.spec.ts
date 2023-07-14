import { expect } from "chai";
import { TaskExecutor } from "../../yajsapi/index.js";
import { LoggerMock } from "../mock/index.js";
import { fileExistsSync } from "tsconfig-paths/lib/filesystem.js";

const logger = new LoggerMock(false);
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

describe("Blender rendering", function () {
  let executor: TaskExecutor;
  afterEach(async function () {
    this.timeout(100000);
    await executor.end();
  });
  it("should render images by blender", async () => {
    executor = await TaskExecutor.create({
      package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
      logger,
      payment: { network: "rinkeby" },
      isSubprocess: true,
    });
    executor.beforeEach(async (ctx) => {
      await ctx.uploadFile(
        new URL("../mock/fixtures/cubes.blend", import.meta.url).pathname,
        "/golem/resource/scene.blend"
      );
    });
    const data = [0, 10, 20, 30, 40, 50];
    const results = executor.map<number, string>(data, async (ctx, frame) => {
      const result = await ctx
        .beginBatch()
        .uploadJson(blender_params(frame), "/golem/work/params.json")
        .run("/golem/entrypoints/run-blender.sh")
        .downloadFile(`/golem/output/out${frame?.toString().padStart(4, "0")}.png`, `output_${frame}.png`)
        .end()
        .catch((error) => ctx.rejectResult(error.toString()));
      return result ? `output_${frame}.png` : "";
    });
    const expectedResults = data.map((d) => `output_${d}.png`);
    for await (const result of results) expect(result).to.be.oneOf(expectedResults);
    for (const file of expectedResults)
      expect(fileExistsSync(`${process.env.GOTH_GFTP_VOLUME || ""}${file}`)).to.be.true;
  }).timeout(240000);
});
