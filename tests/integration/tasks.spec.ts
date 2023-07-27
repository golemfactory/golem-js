import { expect } from "chai";
import { LoggerMock } from "../mock";
import { readFileSync } from "fs";
import { TaskExecutor } from "../../yajsapi";
const logger = new LoggerMock(false);

describe("Task Executor", function () {
  let executor: TaskExecutor;
  beforeEach(function () {
    logger.clear();
  });

  afterEach(async function () {
    this.timeout(60000);
    logger.clear();
    await executor?.end();
  });

  it("should run simple task", async () => {
    executor = await TaskExecutor.create({
      package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
      payment: { network: "rinkeby" },
      logger,
    });
    const result = await executor.run(async (ctx) => ctx.run("echo 'Hello World'"));

    expect(result?.stdout).to.include("Hello World");
    expect(logger.logs).to.include("Demand published on the market");
    expect(logger.logs).to.include("New proposal has been received");
    expect(logger.logs).to.include("Proposal has been responded");
    expect(logger.logs).to.include("New proposal added to pool");
    expect(logger.logs).to.match(/Agreement confirmed by provider/);
    expect(logger.logs).to.match(/Activity .* created/);
  }).timeout(60000);

  it("should run simple task using package tag", async () => {
    executor = await TaskExecutor.create({
      package: "golem/alpine:3.18.2",
      payment: { network: "rinkeby" },
      logger,
    });
    const result = await executor.run(async (ctx) => ctx.run("echo 'Hello World'"));

    expect(result?.stdout).to.include("Hello World");
    expect(logger.logs).to.include("Demand published on the market");
    expect(logger.logs).to.include("New proposal has been received");
    expect(logger.logs).to.include("Proposal has been responded");
    expect(logger.logs).to.include("New proposal added to pool");
    expect(logger.logs).to.match(/Agreement confirmed by provider/);
    expect(logger.logs).to.match(/Activity .* created/);
  }).timeout(60000);

  it("should run simple tasks by map function", async () => {
    executor = await TaskExecutor.create({
      package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
      payment: { network: "rinkeby" },
      logger,
    });
    const data = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
    const results = executor.map<string, string>(data, async (ctx, x) => {
      const res = await ctx.run(`echo "${x}"`);
      return res.stdout?.trim();
    });
    const finalOutputs: string[] = [];
    for await (const res of results) if (res) finalOutputs.push(res);
    expect(finalOutputs).to.have.members(data);
  }).timeout(90000);

  it("should run simple tasks by forEach function", async () => {
    executor = await TaskExecutor.create({
      package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
      payment: { network: "rinkeby" },
      logger,
    });
    const data = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
    await executor.forEach(data, async (ctx, x) => {
      const res = await ctx.run(`echo "${x}"`);
      expect(res?.stdout?.trim()).to.be.oneOf(data);
    });
  }).timeout(80000);

  it("should run simple batch script and get results as stream", async () => {
    executor = await TaskExecutor.create({
      package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
      payment: { network: "rinkeby" },
      logger,
    });
    const outputs: string[] = [];
    let onEnd = "";
    await executor
      .run(async (ctx) => {
        const results = await ctx
          .beginBatch()
          .run('echo "Hello Golem"')
          .run('echo "Hello World"')
          .run('echo "OK"')
          .endStream();
        results.on("data", ({ stdout }) => outputs.push(stdout?.trim()));
        results.on("close", () => (onEnd = "END"));
      })
      .catch((e) => {
        executor.end();
        expect(e).to.be.undefined;
      });
    await logger.expectToInclude("Task 1 computed by provider", 5000);
    expect(outputs[0]).to.equal("Hello Golem");
    expect(outputs[1]).to.equal("Hello World");
    expect(outputs[2]).to.equal("OK");
    expect(onEnd).to.equal("END");
  }).timeout(80000);

  it("should run simple batch script and catch error on stream", async () => {
    executor = await TaskExecutor.create({
      package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
      payment: { network: "rinkeby" },
      logger,
    });
    const outputs: string[] = [];
    let expectedError = "";
    await executor
      .run(async (ctx) => {
        const results = await ctx.beginBatch().run('echo "Hello Golem"').run("invalid_command").endStream();
        results.on("data", ({ stdout }) => outputs.push(stdout?.trim()));
        results.on("error", (error) => {
          expectedError = error.toString();
        });
      })
      .catch((e) => {
        expect(e).to.be.undefined;
      });
    await logger.expectToInclude("Task 1 computed by provider", 5000);
    expect(outputs[0]).to.equal("Hello Golem");
    expect(expectedError).to.equal(
      "Error: ExeScript command exited with code 127. Stdout: undefined. Stderr: sh: 1: invalid_command: not found",
    );
  }).timeout(80000);

  it("should run simple batch script and get results as promise", async () => {
    executor = await TaskExecutor.create({
      package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
      payment: { network: "rinkeby" },
      logger,
    });
    const outputs: string[] = [];
    await executor
      .run(async (ctx) => {
        const results = await ctx
          .beginBatch()
          .run('echo "Hello Golem"')
          .run('echo "Hello World"')
          .run('echo "OK"')
          .end()
          .catch((e) => expect(e).to.be.undefined);
        results.map((r) => outputs.push(r?.stdout?.trim()));
      })
      .catch((e) => {
        expect(e).to.be.undefined;
      });
    expect(outputs[0]).to.equal("Hello Golem");
    expect(outputs[1]).to.equal("Hello World");
    expect(outputs[2]).to.equal("OK");
  }).timeout(60000);

  it("should run simple batch script and catch error on promise", async () => {
    executor = await TaskExecutor.create({
      package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
      payment: { network: "rinkeby" },
      logger,
    });
    let results;
    let error;
    await executor
      .run(async (ctx) => {
        results = await ctx
          .beginBatch()
          .run('echo "Hello Golem"')
          .run("invalid_command")
          .end()
          .catch((err) => (error = err));
      })
      .catch((e) => {
        expect(e).to.be.undefined;
      });
    expect(error).to.equal("Error: ExeScript command exited with code 127");
  }).timeout(80000);

  it("should run transfer file", async () => {
    executor = await TaskExecutor.create({
      package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
      payment: { network: "rinkeby" },
      logger,
    });
    const result = await executor.run(async (ctx) => {
      await ctx.uploadJson({ test: "1234" }, "/golem/work/test.json");
      const res = await ctx.downloadFile("/golem/work/test.json", "new_test.json");
      return res?.result;
    });
    expect(result).to.equal("Ok");
    expect(readFileSync(`${process.env.GOTH_GFTP_VOLUME || ""}new_test.json`, "utf-8")).to.equal('{"test":"1234"}');
  }).timeout(60000);
});
