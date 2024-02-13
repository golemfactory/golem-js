import { TaskExecutor } from "@golem-sdk/golem-js";

const executor = await TaskExecutor.create("golem/alpine:latest");
const finalResult = await executor.run(async (ctx) => {
  const remoteProcess = await ctx.spawn("sleep 1 && echo 'Hello World' && echo 'Hello Golem' >&2");
  remoteProcess.stdout.on("data", (data) => console.log("stdout>", data));
  remoteProcess.stderr.on("data", (data) => console.error("stderr>", data));

  const finalResult = await remoteProcess.waitForExit();
  return finalResult;
});

console.log(finalResult);

await executor.shutdown();
