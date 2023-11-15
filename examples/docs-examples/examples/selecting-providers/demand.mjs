import { TaskExecutor } from "@golem-sdk/golem-js";

(async function main() {
  const executor = await TaskExecutor.create({
    package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
    //minCpuCores : 2,
    //minMemGib : 8,
    //minStorageGib: 10,
    minCpuThreads: 1,
    yagnaOptions: { apiKey: "try_golem" },
  });

  try {
    await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
  } catch (err) {
    console.error("An error occurred:", err);
  } finally {
    await executor.end();
  }
})();
