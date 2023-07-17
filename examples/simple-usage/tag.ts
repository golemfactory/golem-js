import { TaskExecutor } from "yajsapi";

(async function main() {
  const executor = await TaskExecutor.create("golem/alpine:3.18.2");
  // or const executor = await TaskExecutor.create({ package: "golem/alpine:3.18.2" });
  const results = await executor.run(async (ctx) => {
    const res1 = await ctx.run('echo "Hello"');
    const res2 = await ctx.run('echo "World"');
    return `${res1.stdout}${res2.stdout}`;
  });
  console.log(results);
  await executor.end();
})();
