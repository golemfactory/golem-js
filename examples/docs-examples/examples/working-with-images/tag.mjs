import { TaskExecutor } from "@golem-sdk/golem-js";

(async () => {
  const executor = await TaskExecutor.create({
    package: "golem/alpine:latest",
    yagnaOptions: { apiKey: "try_golem" },
  });

  const result = await executor.run(async (ctx) => (await ctx.run("node -v")).stdout);

  await executor.shutdown();

  console.log("Task result:", result);
})();
