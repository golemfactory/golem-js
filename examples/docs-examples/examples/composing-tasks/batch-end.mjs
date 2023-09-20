import { TaskExecutor } from "@golem-sdk/golem-js";

(async () => {
  const executor = await TaskExecutor.create({
    package: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
    yagnaOptions: { apiKey: "try_golem" },
  });

  const result = await executor.run(async (ctx) => {
    const res = await ctx
      .beginBatch()
      .uploadFile("./worker22222.mjs", "/golem/input/worker.mjs")
      .run("node /golem/input/worker.mjs > /golem/input/output.txt")
      .run("cat /golem/input/output.txt")
      .downloadFile("/golem/input/output.txt", "./output.txt")
      .end()
      .catch((error) => console.error(error)); // to be removed and replaced with try & catch

    return res[2]?.stdout;
  });

  console.log(result);
  await executor.end();
})();
