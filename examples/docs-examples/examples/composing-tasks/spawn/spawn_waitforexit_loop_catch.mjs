import { TaskExecutor, LogLevel } from "@golem-sdk/golem-js";

dotenv.config();

(async function main() {
  const executor = await TaskExecutor.create({
    // What do you want to run
    package: "f4a261ea7b760a1da10f21f0ad8d704c25c8d2c75d0bf16300b9721e",
    //payment: { driver: "erc20", network: "holesky" },

    yagnaOptions: { apiKey: "try_golem" },
    budget: 0.5,
    // Control the execution of tasks
    maxTaskRetries: 0,
    maxParallelTasks: 1,
    taskTimeout: 5 * 60 * 1000,
    // Useful for debugging
    logLevel: LogLevel.Info,
  });

  try {
    const data = [1, 2, 3, 4, 5];
    const futureResults = data.map(async (item) => {
      return executor.run(async (ctx) => {
        console.log("Provider deployed", item);

        console.log("spawn started", new Date().toISOString());

        let remote_process = await ctx.spawn("while sleep 1; do ls -l ./golem non-exiting-file; done");
        remote_process.stdout.on("data", (data) => console.log("stdout: ", item, data));
        remote_process.stderr.on("data", (data) => console.log("stderr: ", item, data));

        return await remote_process.waitForExit(5000).catch(async (err) => {
          console.log("Spawn was interrupted");

          await ctx.activity.agreement.terminate();
          console.log("Task completed", new Date().toISOString());
          console.log("Agreement terminated");
          return 1;
        }); // default wait timeout is 20 secs, here 5 secs
      });
    });

    const results = await Promise.all(futureResults);
    results.forEach((result) => console.log(result));
  } catch (err) {
    console.error("Running the task on Golem failed due to", err);
  } finally {
    await executor.shutdown();
  }
})();
