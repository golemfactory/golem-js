const { createExecutor } = require("../../dist");

(async function main() {
  const executor = await createExecutor("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
  await executor
    .run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout))
    .catch(e => {
    // todo
  });
  await executor.end();
})();
