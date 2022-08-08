const { Golem } = require("../../dist");
// const { utils } = require("../../dist");
// utils.changeLogLevel("debug");

(async function main() {
  const golem = new Golem("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
  await golem.init();
  const results = await golem.run((ctx) => ctx.run("/hello_world.sh"));
  console.log(results[0].stdout);
})();
