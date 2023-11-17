import { LoggerMock } from "../mock";
import { readFileSync } from "fs";
import { Result, TaskExecutor } from "../../src";
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
      package: "golem/alpine:latest",
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

  it("should run simple task and get error for invalid command", async () => {
    executor = await TaskExecutor.create({
      package: "golem/alpine:latest",
      logger,
    });
    const result1 = await executor.run(async (ctx) => ctx.run("echo 'Hello World'"));
    const result2 = await executor.run(async (ctx) => ctx.run("invalid-command"));

    expect(result1?.stdout).toContain("Hello World");
    expect(result2?.result).toEqual("Error");
    expect(result2?.stderr).toContain("sh: invalid-command: not found");
    expect(result2?.message).toEqual("ExeScript command exited with code 127");
  });

  it("should run simple task using package tag", async () => {
    executor = await TaskExecutor.create({
      package: "golem/alpine:latest",
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
      package: "golem/alpine:latest",
      logger,
    });
    const data = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
    const futureResults = data.map((x) =>
      executor.run(async (ctx) => {
        const res = await ctx.run(`echo "${x}"`);
        return res.stdout?.toString().trim();
      }),
    );
    const finalOutputs = (await Promise.all(futureResults)).filter((x) => !!x);
    expect(finalOutputs).toEqual(expect.arrayContaining(data));
  });

  it("should run simple batch script and get results as stream", async () => {
    executor = await TaskExecutor.create({
      package: "golem/alpine:latest",
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
        results.on("data", ({ stdout }) => outputs.push(stdout.toString().trim()));
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

  it("should run simple batch script and get results as promise", async () => {
    executor = await TaskExecutor.create({
      package: "golem/alpine:latest",
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
        results.map((r) => outputs.push(r?.stdout?.toString().trim() ?? "Missing STDOUT!"));
      })
      .catch((e) => {
        expect(e).toBeUndefined();
      });
    expect(outputs[0]).toEqual("Hello Golem");
    expect(outputs[1]).toEqual("Hello World");
    expect(outputs[2]).toEqual("OK");
  });

  it("should run transfer file", async () => {
    executor = await TaskExecutor.create({
      package: "golem/alpine:latest",
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

  it("should run transfer file via http", async () => {
    executor = await TaskExecutor.create({
      package: "golem/alpine:latest",
      logger,
    });
    const result = await executor.run(async (ctx) => {
      const res = await ctx.transfer(
        "http://registry.golem.network/download/a2bb9119476179fac36149723c3ad4474d8d135e8d2d2308eb79907a6fc74dfa",
        "/golem/work/alpine.gvmi",
      );
      return res.result;
    });
    expect(result).toEqual("Ok");
  });

  it("should get ip address", async () => {
    executor = await TaskExecutor.create({
      package: "golem/alpine:latest",
      capabilities: ["vpn"],
      networkIp: "192.168.0.0/24",
      logger,
    });
    const result = await executor.run(async (ctx) => ctx.getIp());
    expect(["192.168.0.2", "192.168.0.3"]).toContain(result);
  });

  it("should spawn command as external process", async () => {
    executor = await TaskExecutor.create({
      package: "golem/alpine:latest",
      logger,
    });
    let stdout = "";
    let stderr = "";
    const finalResult = await executor.run(async (ctx) => {
      const remoteProcess = await ctx.spawn("sleep 1 && echo 'Hello World' && echo 'Hello Golem' >&2");
      remoteProcess.stdout.on("data", (data) => (stdout += data.trim()));
      remoteProcess.stderr.on("data", (data) => (stderr += data.trim()));
      return remoteProcess.waitForExit();
    });
    expect(stdout).toContain("Hello World");
    expect(stderr).toContain("Hello Golem");
    expect(finalResult?.result).toContain("Ok");
    expect(logger.logs).toContain("Demand published on the market");
    expect(logger.logs).toContain("New proposal has been received");
    expect(logger.logs).toContain("Proposal has been responded");
    expect(logger.logs).toContain("New proposal added to pool");
    expect(logger.logs).toMatch(/Agreement confirmed by provider/);
    expect(logger.logs).toMatch(/Activity .* created/);
  });
});
