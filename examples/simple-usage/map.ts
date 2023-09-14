import { TaskExecutor } from "@golem-sdk/golem-js";

(async function main() {
  const executor = await TaskExecutor.create("golem/alpine:latest");
  const data = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

  const results = executor.map<string, string | undefined>(data, async (ctx, x) => {
    const res = await ctx.run(`echo "${x}"`);
    return res.stdout?.toString().trim();
  });
  const finalOutput: string[] = [];
  for await (const res of results) {
    if (res) finalOutput.push(res);
  }
  console.log("RESULTS = ", finalOutput.join(", "));
  await executor.end();
})();
