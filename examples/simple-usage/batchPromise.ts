import { TaskExecutor } from "@golem-sdk/golem-js";

(async function main() {
  const executor = await TaskExecutor.create("golem/alpine:latest");
  await executor.run(async (ctx) => {
    const res = await ctx
      .beginBatch()
      .run('echo "Hello Golem"')
      .run('echo "Hello World"')
      .end()
      .catch((error) => console.log(error));
    res?.map(({ stdout }) => console.log(stdout));
  });
  await executor.shutdown();
})();
