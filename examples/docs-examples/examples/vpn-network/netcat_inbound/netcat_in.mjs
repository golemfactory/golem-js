import dotenv from "dotenv";

import { TaskExecutor, LogLevel } from "@golem-sdk/golem-js";

import { runProxy, stopProxy } from "./proxy.mjs";

dotenv.config();

(async function main() {
  const executor = await TaskExecutor.create({
    // What do you want to run
    capabilities: ["vpn"],
    package: "f4a261ea7b760a1da10f21f0ad8d704c25c8d2c75d0bf16300b9721e",

    yagnaOptions: { apiKey: "try_golem" },
    budget: 0.5,
    networkIp: "192.168.0.0/24",

    taskTimeout: 5 * 60 * 1000, // 5 min
    // Useful for debugging
    logLevel: LogLevel.Info,
  });

  let serverIP;
  let networkID;
  let port_tgt = 1234;

  try {
    // Your code goes here

    let result = executor.run(async (ctx) => {
      let netID = ctx.getWebsocketUri(1234);
      let idxB = netID.indexOf("net/") + 4;
      let idxE = netID.indexOf("/tcp");
      serverIP = ctx.getIp();
      networkID = netID.slice(idxB, idxE);
      console.log(
        "Netcat on the Provider will listen on: ",
        serverIP,
        "port: 1234"
      );
      await ctx.run(`timeout 20 nc -l ${port_tgt} > netcat_received`);
      console.log("Netcat will stop listening");
      //await new Promise((res) => setTimeout(res, 30 * 1000));
      return (await ctx.run("cat netcat_received")).stdout;
    });

    while (!serverIP && !networkID) {
      await new Promise((res) => setTimeout(res, 1 * 1000));
    }

    runProxy(networkID, serverIP, port_tgt);

    console.log("Provider received:", await result);
  } catch (err) {
    console.error("Running the task on Golem failed due to", err);
  } finally {
    stopProxy();
    await executor.shutdown();
    //process.exit(0);
  }
})();
