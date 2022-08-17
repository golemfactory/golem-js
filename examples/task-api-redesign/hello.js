const { Golem } = require("../../dist");
// const { utils } = require("../../dist");
// utils.changeLogLevel("debug");

(async function main() {
  const golem = new Golem("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
  await golem.init();
  await golem.run(async (ctx) => console.log((await ctx.run("echo 'Hello World 11111!'")).stdout));
  await golem.run(async (ctx) => console.log((await ctx.run("echo 'Hello World 22222!'")).stdout));
  await golem.end();
})();
