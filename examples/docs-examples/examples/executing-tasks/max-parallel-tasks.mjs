import { TaskExecutor } from "@golem-sdk/golem-js";

(async () => {
  const executor = await TaskExecutor.create({
    package: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
    yagnaOptions: { apiKey: "try_golem" },
    maxParallelTasks: 3,
  });

  try {
    const data = [1, 2, 3, 4, 5];
    const futureResults = data.map((item) => executor.run((ctx) => ctx.run(`echo "${item}"`)));
    const results = await Promise.all(futureResults);
    results.forEach((result) => console.log(result.stdout));
  } catch (err) {
    console.error("Error occurred during task execution:", err);
  } finally {
    await executor.shutdown();
  }
})();
