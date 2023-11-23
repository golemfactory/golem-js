import { TaskExecutor } from "@golem-sdk/golem-js";

(async () => {
  const executor = await TaskExecutor.create({
    package: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
    yagnaOptions: { apiKey: "try_golem" },
  });

  try {
    // there is a mistake and instead of 'node -v' we call 'node -w'
    const result = await executor.run(async (ctx) => await ctx.run("node -w"));
    console.log("Task result:", result);
  } catch (err) {
    console.error("Error during the task:", err);
  } finally {
    await executor.end();
  }
})();
