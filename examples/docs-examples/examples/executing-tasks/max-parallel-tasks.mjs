import { TaskExecutor } from "@golem-sdk/golem-js";

(async () => {
  const executor = await TaskExecutor.create({
    package: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
    yagnaOptions: { apiKey: "try_golem" },
    maxParallelTasks: 3, // default is 5
  });

  const data = [1, 2, 3, 4, 5];

  const futureResults = data.map(async (item) =>
    executor.run(async (ctx) => {
      return await ctx.run(`echo "${item}"`);
    }),
  );

  const results = await Promise.all(futureResults);
  results.forEach((result) => console.log(result.stdout));

  await executor.end();
})();
