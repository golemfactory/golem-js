import { Golem } from "../../dist";

(async function main() {
  const golem = new Golem("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
  await golem.init();
  const data = ["one", "two", "three", "four"];

  const results = golem.map<string, string>(data, async (ctx, x) => {
    const res = await ctx.run(`echo "${x}"`);
    console.log(`Result=${res.stdout}`);
    return res.stdout;
  });
  const finalOutput: string[] = [];
  for await (const res of results) {
    finalOutput.push(res);
  }
  console.log({ finalOutput });
  await golem.end();
})();
