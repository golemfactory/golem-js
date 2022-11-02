import { createExecutor } from "../../dist";

(async function main() {
  const executor = await createExecutor("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
  const data = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

  const results = executor.map<string, string>(data, async (ctx, x) => {
    const res = await ctx.run(`echo "${x}"`);
    return res.stdout?.trim();
  });
  const finalOutput: string[] = [];
  for await (const res of results) {
    if (res) finalOutput.push(res);
  }
  console.log("RESULTS = ", finalOutput.join(", "));
  await executor.end();
})();
