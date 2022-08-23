import { Golem } from "../../dist";
// const { utils } = require("../../dist");
// utils.changeLogLevel("debug");

(async function main() {
  const golem = new Golem("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
  await golem.init();
  const results = await golem.run<string>(async (ctx) => {
    const res1 = await ctx.run('echo "Hello"');
    const res2 = await ctx.run('echo "World"');
    return res1.stdout + res2.stdout;
  });
  console.log(results);
  await golem.end();
})();
