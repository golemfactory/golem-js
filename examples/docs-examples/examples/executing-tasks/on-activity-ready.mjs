import { TaskExecutor } from "@golem-sdk/golem-js";

(async () => {
  const executor = await TaskExecutor.create({
    package: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
    yagnaOptions: { apiKey: "try_golem" },
    maxParallelTasks: 3,
  });

  executor.onActivityReady(async (ctx) => {
    console.log(ctx.provider.name + " is downloading action_log file");
    await ctx.uploadFile("./action_log.txt", "/golem/input/action_log.txt");
  });

  const inputs = [1, 2, 3, 4, 5];

  const futureResults = inputs.map(async (item) => {
    return await executor.run(async (ctx) => {
      await ctx
        .beginBatch()
        .run(`echo ` + `'processing item: ` + item + `' >> /golem/input/action_log.txt`)
        .downloadFile("/golem/input/action_log.txt", "./output_" + ctx.provider.name + ".txt")
        .end();
    });
  });
  await Promise.all(futureResults);

  await executor.shutdown();
})();
