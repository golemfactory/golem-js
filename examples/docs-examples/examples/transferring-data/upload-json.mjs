import { TaskExecutor } from "@golem-sdk/golem-js";

(async () => {
  const executor = await TaskExecutor.create({
    package: "dcd99a5904bebf7ca655a833b73cc42b67fd40b4a111572e3d2007c3",
    yagnaOptions: { apiKey: "try_golem" },
  });

  try {
    const output = await executor.run(async (ctx) => {
      // Upload test JSON object
      await ctx.uploadJson({ input: "Hello World" }, "/golem/work/input.json");

      // Read the content of the JSON object.
      return await ctx.run("cat /golem/work/input.json");
    });
    console.log(output.stdout);
  } catch (error) {
    console.error("Computation failed:", error);
  } finally {
    await executor.end();
  }
})();
