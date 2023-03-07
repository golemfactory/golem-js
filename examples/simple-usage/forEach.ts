import { TaskExecutor } from "yajsapi";

(async function main() {
  const executor = await TaskExecutor.create("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
  const data = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  await executor.forEach(data, async (ctx, x) => {
    const res = await ctx.run(`echo "${x}"`);
    console.log(`Result=${res.stdout}`);
  });
  await executor.end();
})();
