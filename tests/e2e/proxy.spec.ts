import { TaskExecutor } from "../../src";
import { LoggerMock } from "../mock";
import { sleep } from "../../src/utils";
import fs from "fs";

const logger = new LoggerMock(false);

describe("TcpProxy", function () {
  beforeEach(function () {
    logger.clear();
  });
  it("should send and receive message to the http server on the provider", async () => {
    const executor = await TaskExecutor.create({
      package: "golem/node:latest",
      capabilities: ["vpn"],
      networkIp: "192.168.0.0/24",
      logger,
    });
    let response;
    let providerStdout = "";
    await executor.run(async (ctx) => {
      await ctx.uploadFile(fs.realpathSync(__dirname + "../../../examples/proxy/server.js"), "/golem/work/server.js");
      const server = await ctx.spawn("node /golem/work/server.js");
      server.stdout.on("data", (data) => (providerStdout += data.toString()));
      const proxy = ctx.createTcpProxy(80);
      await proxy.listen(7777);
      await sleep(10);
      response = await fetch("http://localhost:7777");
      await proxy.close();
    });
    await executor.shutdown();
    expect((await response.text()).trim()).toEqual("Hello Golem!");
    expect(providerStdout).toContain('HTTP server started at "http://localhost:80"');
  });
});
