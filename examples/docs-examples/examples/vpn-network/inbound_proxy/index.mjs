import { TaskExecutor, LogLevel } from "@golem-sdk/golem-js";

import { startProxy, stopProxy } from "./proxy.mjs";

(async function main() {
  const executor = await TaskExecutor.create({
    // What do you want to run
    capabilities: ["vpn"],
    package: "golem/node:latest",

    yagnaOptions: { apiKey: "try_golem" },
    budget: 0.5,
    networkIp: "192.168.0.0/24",

    taskTimeout: 6 * 60 * 1000, // 5 min
    // Useful for debugging
    logLevel: LogLevel.Info,
  });

  let serverIP;
  let networkID;
  let port_tgt = 80;

  try {
    // Your code goes here

    await executor.run(async (ctx) => {
      let netUri = ctx.getWebsocketUri(port_tgt);
      let idxB = netUri.indexOf("net/") + 4;
      let idxE = netUri.indexOf("/tcp");
      serverIP = ctx.getIp();
      networkID = netUri.slice(idxB, idxE);
      await ctx.uploadFile("./http_server.js", "/golem/work/server.js");
      await ctx.uploadJson({ port: 80, host: "0.0.0.0", server: ctx.provider.name }, "/golem/work/config.json");
      console.log("provider server was uploaded");
      startProxy(networkID, serverIP, port_tgt);

      await ctx.run("timeout 30 node server.js");
    });
  } catch (err) {
    console.error("Running the task on Golem failed due to", err);
  } finally {
    console.log("provider server is stopped");
    stopProxy();
    await executor.shutdown();
    //process.exit(0);
  }
})();
