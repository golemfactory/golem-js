const { createGolem } = require("../../dist");

(async function main() {
  const golem = await createGolem("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
  await golem.run(async (ctx) => console.log((await ctx.run("echo 'Hello World 1'")).stdout));
  await golem.end();
})();
