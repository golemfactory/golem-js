import { TaskExecutor } from "@golem-sdk/golem-js";

(async () => {
  const executor = await TaskExecutor.create({
    package: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
    yagnaOptions: { apiKey: "try_golem" },
  });

  const data = [1, 2, 3, 4, 5];

  await executor.forEach(data, async (ctx, item) => {
    console.log((await ctx.run(`echo "${item}"`)).stdout);
  });

  await executor.end();
})();
