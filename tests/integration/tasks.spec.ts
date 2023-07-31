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

    expect(result?.stdout).toContain("Hello World");
    expect(logger.logs).toContain("Demand published on the market");
    expect(logger.logs).toContain("New proposal has been received");
    expect(logger.logs).toContain("Proposal has been responded");
    expect(logger.logs).toContain("New proposal added to pool");
    expect(logger.logs).toMatch(/Agreement confirmed by provider/);
    expect(logger.logs).toMatch(/Activity .* created/);
  });

  it("should run simple task using package tag", async () => {
    executor = await TaskExecutor.create({
      package: "golem/alpine:3.18.2",
      payment: { network: "rinkeby" },
      logger,
    });
    const result = await executor.run(async (ctx) => ctx.run("echo 'Hello World'"));

    expect(result?.stdout).toContain("Hello World");
    expect(logger.logs).toContain("Demand published on the market");
    expect(logger.logs).toContain("New proposal has been received");
    expect(logger.logs).toContain("Proposal has been responded");
    expect(logger.logs).toContain("New proposal added to pool");
    expect(logger.logs).toMatch(/Agreement confirmed by provider/);
    expect(logger.logs).toMatch(/Activity .* created/);
  });

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
    expect(finalOutputs).toEqual(expect.arrayContaining([data]));
  });

  it("should run simple tasks by forEach function", async () => {
    executor = await TaskExecutor.create({
      package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
      payment: { network: "rinkeby" },
      logger,
    });
    const data = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
    await executor.forEach(data, async (ctx, x) => {
      const res = await ctx.run(`echo "${x}"`);
      expect(data).toContain(res?.stdout?.trim());
    });
  });

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
        expect(e).toBeUndefined();
      });
    await logger.expectToInclude("Task 1 computed by provider", 5000);
    expect(outputs[0]).toEqual("Hello Golem");
    expect(outputs[1]).toEqual("Hello World");
    expect(outputs[2]).toEqual("OK");
    expect(onEnd).toEqual("END");
  });

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
        expect(e).toBeUndefined();
      });
    await logger.expectToInclude("Task 1 computed by provider", 5000);
    expect(outputs[0]).toEqual("Hello Golem");
    expect(expectedError).toEqual(
      "Error: ExeScript command exited with code 127. Stdout: undefined. Stderr: sh: 1: invalid_command: not found",
    );
  });

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
          .end();
        results.map((r) => outputs.push(r?.stdout?.trim() ?? "Missing STDOUT!"));
      })
      .catch((e) => {
        expect(e).toBeUndefined();
      });
    expect(outputs[0]).toEqual("Hello Golem");
    expect(outputs[1]).toEqual("Hello World");
    expect(outputs[2]).toEqual("OK");
  });

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
        expect(e).toBeUndefined();
      });
    expect(error).toEqual("Error: ExeScript command exited with code 127");
  });

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
    expect(result).toEqual("Ok");
    expect(readFileSync(`${process.env.GOTH_GFTP_VOLUME || ""}new_test.json`, "utf-8")).toEqual('{"test":"1234"}');
  });
});
