import { TaskExecutor } from "@golem-sdk/golem-js";

(async function main() {
  const executor = await TaskExecutor.create("golem/alpine:latest");
  const data = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  await executor.forEach(data, async (ctx, x) => {
    const res = await ctx.run(`echo "${x}"`);
    console.log(`Result=${res.stdout}`);
  });
  await executor.end();
})();
