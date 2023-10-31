import { LoggerMock } from "../mock";
import { readFileSync } from "fs";
import { TaskExecutor } from "../../src";
import fs from "fs";
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
    const results = executor.map<string, string | undefined>(data, async (ctx, x) => {
      const res = await ctx.run(`echo "${x}"`);
      return res.stdout?.toString().trim();
    });
    const finalOutputs: string[] = [];
    for await (const res of results) if (res) finalOutputs.push(res);
    expect(finalOutputs).toEqual(expect.arrayContaining(data));
  });

  it("should run simple tasks by forEach function", async () => {
    executor = await TaskExecutor.create({
      package: "golem/alpine:latest",
      logger,
    });
    const data = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
    await executor.forEach(data, async (ctx, x) => {
      const res = await ctx.run(`echo "${x}"`);
      expect(data).toContain(res?.stdout?.toString().trim());
    });
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

  it("should run simple task and get results as stream", async () => {
    executor = await TaskExecutor.create({
      package: "golem/alpine:latest",
      logger,
    });
    await executor.run(async (ctx) => {
      // for some reason we do not receive events for very simple commands,
      // it is probably related to a bug where the command ends and the event does not have time to be triggered or handled
      // after creating the EventSource connection to yagna... to investigate.
      // for now, sleep 2 has been added, which solves the problem temporarily
      const streamOfResults = await ctx.runAndStream("sleep 2 && echo 'Hello World'");
      for await (const result of streamOfResults) {
        expect(result.stdout).toContain("Hello World");
        expect(result.result).toContain("Ok");
      }
    });
    expect(logger.logs).toContain("Demand published on the market");
    expect(logger.logs).toContain("New proposal has been received");
    expect(logger.logs).toContain("Proposal has been responded");
    expect(logger.logs).toContain("New proposal added to pool");
    expect(logger.logs).toMatch(/Agreement confirmed by provider/);
    expect(logger.logs).toMatch(/Activity .* created/);
  });
});
