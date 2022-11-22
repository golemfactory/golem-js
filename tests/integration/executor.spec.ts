import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { createExecutor } from "../../yajsapi";
import { LoggerMock } from "../mock/logger";
chai.use(chaiAsPromised);
const expect = chai.expect;
const loggerMock = new LoggerMock();

describe("#Executor()", () => {
  let gothProcess;
  before(async () => {
    // run goth process
  });
  // TODO
  it("run simple task", async () => {
    const executor = await createExecutor({
      package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
      logLevel: "debug",
      logger: loggerMock,
      // subnetTag: "goth"
    });
    const result = await executor.run(async (ctx) => ctx.run("echo 'Hello World'"));

    expect(result?.stdout).to.include("Hello World");
    await executor.end();
  }).timeout(30000);
});
