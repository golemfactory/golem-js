import { expect } from "chai";
import { TaskExecutor } from "../../yajsapi/index.js";
import { LoggerMock } from "../mock/index.js";
import { fileExistsSync } from "tsconfig-paths/lib/filesystem.js";

const logger = new LoggerMock(false);

describe("GFTP transfers", function () {
  let executor: TaskExecutor;
  afterEach(async function () {
    this.timeout(60000);
    await executor.end();
  });
  it("should upload and download big files simultaneously", async () => {
    executor = await TaskExecutor.create({
      package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
      payment: { network: "rinkeby" },
      logger,
    });
    executor.beforeEach(async (ctx) => {
      await ctx.uploadFile(
        new URL("../mock/fixtures/eiffel.blend", import.meta.url).pathname,
        "/golem/resource/eiffel.blend",
      );
    });
    const data = [0, 1, 2, 3, 4, 5];
    const results = executor.map<number, string>(data, async (ctx, frame) => {
      const result = await ctx
        .beginBatch()
        .run("ls -Alh /golem/resource/eiffel.blend")
        .downloadFile(`/golem/resource/eiffel.blend`, `copy_${frame}.blend`)
        .end()
        .catch((error) => ctx.rejectResult(error.toString()));
      return result ? `copy_${frame}.blend` : "";
    });
    const expectedResults = data.map((d) => `copy_${d}.blend`);
    for await (const result of results) expect(result).to.be.oneOf(expectedResults);
    for (const file of expectedResults)
      expect(fileExistsSync(`${process.env.GOTH_GFTP_VOLUME || ""}${file}`)).to.be.true;
  }).timeout(240000);
});
