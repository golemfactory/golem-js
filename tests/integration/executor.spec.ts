import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { createExecutor } from "../../yajsapi";
import { LoggerMock } from "../mock";
import { Goth } from "./goth";
import { resolve } from "path";
chai.use(chaiAsPromised);
const expect = chai.expect;
const logger = new LoggerMock();
const gothConfig = resolve("../goth/assets/goth-config.yml");
const goth = new Goth(gothConfig);

describe("Task Executor", function () {
  this.timeout(10000);
  let apiKey, basePath, subnetTag;
  before(async () => {
    ({ apiKey, basePath, subnetTag } = await goth.start());
  });
  after(async () => {
    await goth.end();
  });

  it("should run simple task", async () => {
    const executor = await createExecutor({
      package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
      yagnaOptions: { apiKey, basePath },
      subnetTag,
      logger,
    });
    const result = await executor.run(async (ctx) => ctx.run("echo 'Hello World'"));
    await executor.end();

    expect(result?.stdout).to.include("Hello World");
    expect(logger.logs).to.include("Demand published on the market");
    expect(logger.logs).to.include("New proposal has been received");
    expect(logger.logs).to.include("Scored proposal");
    expect(logger.logs).to.include("Proposal hes been responded");
    expect(logger.logs).to.include("New offer proposal added to pool");
    expect(logger.logs).to.match(/Agreement .* created with provider/);
    expect(logger.logs).to.match(/Activity .* created/);
    expect(logger.logs).to.include("Task Executor has shut down");
  }).timeout(60000);
});
