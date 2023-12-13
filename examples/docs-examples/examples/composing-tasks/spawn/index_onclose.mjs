import dotenv from "dotenv";

import { TaskExecutor, LogLevel } from "@golem-sdk/golem-js";

dotenv.config();

(async function main() {
  const executor = await TaskExecutor.create({
    // What do you want to run
    capabilities: ["vpn"],
    package: "f4a261ea7b760a1da10f21f0ad8d704c25c8d2c75d0bf16300b9721e",

    yagnaOptions: { apiKey: "try_golem" },
    budget: 0.5,
    // Control the execution of tasks
    maxTaskRetries: 2,
    maxParallelTasks: 2,
    taskTimeout: 5 * 60 * 1000,
    // Useful for debugging
    logLevel: LogLevel.Info,
    skipProcessSignals: true, // TaskExecutor will not react on SIGINT
  });

  try {
    // Your code goes here

    let result = await executor.run(async (ctx) => {
      console.log("Provider deployed");
      let remote_process = await ctx.spawn("ls -l .");
      //remote_process.stdout.on("data", (data) => console.log("stdout: ", data));

      // remote_process.stderr.on("data", (data) => console.stderr("stderr: ", data));

      await new Promise((resolve) => {
        remote_process.stdout.on("data", (result) => console.log("stdout", result));
        remote_process.stderr.on("error", (error) => console.error("stderr", error));
        remote_process.stdout.on("close", resolve);
      });
      return 0;
    });

    //await result;

    console.log(result);
  } catch (err) {
    console.error("Running the task on Golem failed due to", err);
  } finally {
    await executor.shutdown();
  }
})();
