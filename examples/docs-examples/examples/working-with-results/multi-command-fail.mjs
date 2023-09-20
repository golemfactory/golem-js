import { TaskExecutor } from "@golem-sdk/golem-js";

(async () => {
  const executor = await TaskExecutor.create({
    package: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
    yagnaOptions: { apiKey: "try_golem" },
  });

  const result = await executor.run(async (ctx) => {
    const res = await ctx
      .beginBatch()
      .run("cat /golem/input/output.txt > /golem/input/output.txt")
      .downloadFile("/golem/output/output.txt", "./output.txt") // there is no such file in output folder
      .run("ls -l /golem/")
      .end()
      .catch((error) => console.error(error));

    return res;
  });

  console.log(result);
  await executor.end();
})();
