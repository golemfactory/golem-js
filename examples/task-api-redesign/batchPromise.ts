import { createGolem } from "../../dist";

(async function main() {
  const golem = await createGolem("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
  await golem.run(async (ctx) => {
    const res = await ctx
      .beginBatch()
      .run('echo "Hello World"')
      .run('echo "Hello Golem"')
      .run("error_command")
      .end()
      .catch((error) => console.log(error));
    res?.map(({ stdout }) => console.log(stdout));
  });
  await golem.end();
})();
