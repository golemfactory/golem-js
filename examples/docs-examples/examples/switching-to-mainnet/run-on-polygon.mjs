import { TaskExecutor } from "@golem-sdk/golem-js";

(async () => {
  const executor = await TaskExecutor.create({
    subnetTag: "public", // do we need to show subnet ??
    payment: { driver: "erc-20", network: "polygon" },
    package: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
    yagnaOptions: { apiKey: "try_golem" },
  });

  const result = await executor.run(async (ctx) => (await ctx.run("node -v")).stdout);
  await executor.end();

  console.log("Task result:", result);
})();
