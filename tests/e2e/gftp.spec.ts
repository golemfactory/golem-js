import { TaskExecutor } from "../../src";
import { LoggerMock } from "../mock";
import fs from "fs";

const logger = new LoggerMock();

describe("GFTP transfers", function () {
  it("should upload and download big files simultaneously", async () => {
    const executor = await TaskExecutor.create({
      package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
      logger,
    });

    executor.beforeEach(async (ctx) => {
      const sourcePath = fs.realpathSync(__dirname + "/../mock/fixtures/eiffel.blend");
      await ctx.uploadFile(sourcePath, "/golem/resource/eiffel.blend");
    });

    const data = [0, 1, 2, 3, 4, 5];

    const results = executor.map(data, async (ctx, frame) => {
      const result = await ctx
        .beginBatch()
        .run("ls -Alh /golem/resource/eiffel.blend")
        .downloadFile(`/golem/resource/eiffel.blend`, `copy_${frame}.blend`)
        .end()
        .catch((error) => ctx.rejectResult(error.toString()));
      return result ? `copy_${frame}.blend` : "";
    });

    const expectedResults = data.map((d) => `copy_${d}.blend`);

    for await (const result of results) {
      expect(expectedResults).toContain(result);
    }

    for (const file of expectedResults) {
      const path = `${process.env.GOTH_GFTP_VOLUME || ""}${file}`;
      expect(fs.existsSync(path)).toEqual(true);
    }

    await executor.end();
  });
});
