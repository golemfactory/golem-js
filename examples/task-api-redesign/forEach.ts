import { createGolem } from "../../dist";

(async function main() {
  const golem = await createGolem("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
  const data = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  await golem.forEach(data, async (ctx, x) => {
    const res = await ctx.run(`echo "${x}"`);
    console.log(`Result=${res.stdout}`);
    return res.stdout?.trim();
  });
  await golem.end();
})();
