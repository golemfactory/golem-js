import { TaskExecutor } from "@golem-sdk/golem-js";

(async function main() {
  const executor = await TaskExecutor.create("golem/alpine:latest");

  try {
    const results = await executor.run(async (ctx) => {
      const res1 = await ctx.run('echo "Hello"');
      const res2 = await ctx.run('echo "World"');
      return `${res1.stdout}${res2.stdout}`;
    });
    console.log(results);
  } catch (err) {
    console.error("An error occurred during execution:", err);
  } finally {
    await executor.shutdown();
  }
})();
