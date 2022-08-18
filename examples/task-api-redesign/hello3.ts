import { Golem } from "../../dist";
// const { utils } = require("../../dist");
// utils.changeLogLevel("debug");

(async function main() {
  const golem = new Golem("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
  await golem.init();
  const data = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

  const results = golem.map<string, string>(data, async (ctx, x) => {
    const res = await ctx.run(`echo "${x}"`);
    console.log(`Result=${res.stdout}`);
    return res.stdout.trim();
  });
  const finalOutput: string[] = [];
  for await (const res of results) {
    if (res) finalOutput.push(res);
  }
  console.log("RESULTS = ", finalOutput.join(", "));
  await golem.end();
})();
