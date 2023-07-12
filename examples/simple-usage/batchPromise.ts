import { TaskExecutor } from "yajsapi";

(async function main() {
  const executor = await TaskExecutor.create("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
  await executor.run(async (ctx) => {
    const res = await ctx
      .beginBatch()
      .run('echo "Hello Golem"')
      .run('echo "Hello World"')
      .end()
      .catch((error) => console.log(error));
    res?.map(({ stdout }) => console.log(stdout));
  });
  await executor.end();
})();
