import { TaskExecutor } from "@golem-sdk/golem-js";
const executor = await TaskExecutor.create({
  package: "golem/alpine:latest",
  yagnaOptions: { apiKey: "try_golem" },
});

try {
  const result = await executor.run(async (ctx) => (await ctx.run("node -v")).stdout);
  console.log("Task result:", result);
} catch (err) {
  console.error("An error occurred:", err);
} finally {
  await executor.shutdown();
}
