import { TaskExecutor } from "@golem-sdk/golem-js";

(async function main() {
  const executor = await TaskExecutor.create("golem/alpine:latest");
  const data = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

  const futureResults = data.map((x) =>
    executor.run(async (ctx) => {
      const res = await ctx.run(`echo "${x}"`);
      return res.stdout?.toString().trim();
    }),
  );

  const results = await Promise.all(futureResults);
  console.log(results);

  await executor.shutdown();
})();
