import { TaskExecutor } from "@golem-sdk/golem-js";

(async () => {
  const executor = await TaskExecutor.create({
    package: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
    yagnaOptions: { apiKey: "try_golem" },
  });

  try {
    const result = await executor.run(async (ctx) => {
      const res = await ctx
        .beginBatch()
        .run("cat /golem/input/output.txt > /golem/input/output.txt")
        .downloadFile("/golem/output/output.txt", "./output.txt") // there is no such file in output folder
        .run("ls -l /golem/")
        .end();

      return res;
    });

    console.log(result);
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    await executor.end();
  }
})();
