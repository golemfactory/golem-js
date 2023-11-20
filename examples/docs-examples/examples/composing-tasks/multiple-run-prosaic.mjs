import { TaskExecutor } from "@golem-sdk/golem-js";

(async () => {
  const executor = await TaskExecutor.create({
    package: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
    yagnaOptions: { apiKey: "try_golem" },
  });

  const result = await executor.run(async (ctx) => {
    await ctx.uploadFile("./worker.mjs", "/golem/input/worker.mjs");
    await ctx.run("node /golem/input/worker.mjs > /golem/input/output.txt");
    const result = await ctx.run("cat /golem/input/output.txt");
    await ctx.downloadFile("/golem/input/output.txt", "./output.txt");
    return result.stdout;
  });

  console.log(result);

  await executor.shutdown();
})();
