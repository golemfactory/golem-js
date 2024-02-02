import { TaskExecutor, LogLevel } from "@golem-sdk/golem-js";

import { startProxy, stopProxy } from "./proxy.mjs";

import * as cp from "child_process";

var spawn = cp.spawn;

const startClient = async (repetition) => {
  for (var i = 0; i < repetition; i++) {
    var exproc = spawn("node", ["client.mjs"]);

    exproc.stdout.on("data", function (data) {
      var output = data
        .toString()
        .split(/(\r?\n)/g)
        .join("");
      console.log(output);
    });

    exproc.on("close", function (code) {
      //console.log("client process exit code " + code);
    });

    await new Promise((res) => setTimeout(res, 3 * 1000));
  }
};

(async function main() {
  const executor = await TaskExecutor.create({
    // What do you want to run
    capabilities: ["vpn"],
    package: "golem/node:latest",
    //payment: { driver: "erc20next", network: "holesky" },

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
    await executor.run(async (ctx) => {
      let netUri = ctx.getWebsocketUri(port_tgt);
      let idxB = netUri.indexOf("net/") + 4;
      let idxE = netUri.indexOf("/tcp");
      serverIP = ctx.getIp();
      networkID = netUri.slice(idxB, idxE);
      await ctx.uploadFile("./http_server.js", "/golem/work/server.js");
      await ctx.uploadJson({ port: 80, host: "0.0.0.0", server: ctx.provider.name }, "/golem/work/config.json");
      console.log("provider server was uploaded");

      ctx.run("timeout 30 node server.js");

      startProxy(networkID, serverIP, port_tgt);
      await new Promise((res) => setTimeout(res, 30 * 1000));
      //startClient(3);
      //await new Promise((res) => setTimeout(res, 30 * 1000));
    });
  } catch (err) {
    console.error("Running the task on Golem failed due to", err);
  } finally {
    console.log("provider server is stopped");
    stopProxy();
    await executor.shutdown();
  }
})();
