import { TaskExecutor } from "@golem-sdk/golem-js";

(async () => {
  const executor = await TaskExecutor.create({
    package: "golem/my_example:latest",
    yagnaOptions: { appKey: "try_golem" },
  });

  const result = await executor.run(async (ctx) => (await ctx.run("node -v")).stdout);

  await executor.end();

  console.log("Task result:", result);
})();
