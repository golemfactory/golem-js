import { createExecutor } from "../../dist";

(async function main() {
  const executor = await createExecutor("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
  await executor.run(async (ctx) => {
    const res = await ctx
      .beginBatch()
      .run('echo "Hello Golem"')
      .run('echo "Hello World"')
      .run("error_command")
      .end()
      .catch((error) => console.log(error));
    res?.map(({ stdout }) => console.log(stdout));
  });
  await executor.end();
})();
