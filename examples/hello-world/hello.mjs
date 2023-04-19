import { TaskExecutor } from "../../dist/index.js";

(async function main() {
  const executor = await TaskExecutor.create({package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae", logger: console});
  await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
  await executor.end();
})();
