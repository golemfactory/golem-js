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
        .uploadFile("./worker.mjs", "/golem/input/worker.mjs")
        .run("node /golem/input/worker.mjs > /golem/input/output.txt")
        .run("cat /golem/input/output.txt")
        .downloadFile("/golem/input/output.txt", "./output.txt")
        .endStream();

      return new Promise((resolve) => {
        res.on("data", (result) => console.log(result));
        res.on("error", (error) => console.error(error));
        res.once("close", resolve);
      });
    });
  } catch (error) {
    console.error("Computation failed:", error);
  } finally {
    await executor.shutdown();
  }
})();
