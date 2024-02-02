import { TaskExecutor, LogLevel } from "@golem-sdk/golem-js";

dotenv.config();

(async function main() {
  const executor = await TaskExecutor.create({
    // What do you want to run
    capabilities: ["vpn"],
    package: "f4a261ea7b760a1da10f21f0ad8d704c25c8d2c75d0bf16300b9721e",

    yagnaOptions: { apiKey: "try_golem" },
    //payment: { driver: "erc20", network: "holesky" },
    budget: 0.5,
    networkIp: "192.168.0.0/24",
    // Control the execution of tasks
    maxParallelTasks: 2,
    taskTimeout: 5 * 60 * 1000, // 5 min
    // Useful for debugging
    logLevel: LogLevel.Info,
  });

  let serverIP;
  let runClient = true;

  try {
    let result = executor.run(async (ctx) => {
      console.log("Netcat provider deployed");
      serverIP = ctx.getIp();
      console.log("Netcat will listen on: ", serverIP, "port: 1234");
      await ctx.run("nc -l 1234 > netcat_received");
      console.log("Netcat will stop listening");
      runClient = false; // stop client
      return (await ctx.run("cat netcat_received")).stdout;
    });

    while (runClient) {
      // wait 1 sec
      await new Promise((res) => setTimeout(res, 1 * 1000));

      if (serverIP) {
        console.log("Will start client");
        await executor.run(async (ctx) => {
          console.log(`Provider ${ctx.provider.name} started as client`);
          await ctx.run(
            `echo "Message from povider ${ctx.provider.name}, date: ${new Date().toISOString()}" > /golem/data`,
          );

          let res = await ctx.run(`echo "Hello Golem provider" | nc -q 1 ${serverIP} 1234`);
          console.log("Client task completed");
          return res;
        });
        runClient = false;
      }
    }
    //await result;
    let logsFromServer = await result;
    console.log(logsFromServer);
  } catch (err) {
    console.error("Running the task on Golem failed due to", err);
  } finally {
    await executor.shutdown();
  }
})();
