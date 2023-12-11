import { TaskExecutor } from "@golem-sdk/golem-js";
(async () => {
  const executor = await TaskExecutor.create({
    package: "8b238595299444d0733b41095f27fadd819a71d29002b614c665b27c",
    yagnaOptions: { apiKey: "try_golem" },
  });

  try {
    const result = await executor.run(async (ctx) => {
      console.log("Description.txt: ", (await ctx.run("cat /golem/info/description.txt")).stdout);
      console.log("/golem/work content: ", (await ctx.run("ls /golem/work")).stdout);
    });
  } catch (err) {
    console.error("An error occurred:", err);
  } finally {
    await executor.shutdown();
  }
})();
