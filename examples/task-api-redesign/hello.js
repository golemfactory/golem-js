const { createGolem } = require("../../dist");

(async function main() {
  const golem = new Golem();
  const executor = await golem.createExecutor("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
  await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello Golem'")).stdout));
  await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello Golem 2'")).stdout));
  await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello Golem 3'")).stdout));
  await executor.end();
})();
