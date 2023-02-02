const { TaskExecutor } = require("../../dist");

(async function main() {
  const executor = await TaskExecutor.create("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
  await executor.run(async (ctx) => console.log("\n\t" + (await ctx.run("echo 'Hello World'")).stdout) + "\n");
  await executor.end();
})();
