import { TaskExecutor, LogLevel } from "../../dist";

(async function main() {
  const executor = await TaskExecutor.create({
    package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
    logLevel: LogLevel.info,
  });
  const results = await executor.run(async (ctx) => {
    const res1 = await ctx.run('echo "Hello"');
    const res2 = await ctx.run('echo "World"');
    return `${res1.stdout}${res2.stdout}`;
  });
  console.log(results);
  await executor.end();
})();
