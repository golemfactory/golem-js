import { TaskExecutor } from "@golem-sdk/golem-js";

const executor = await TaskExecutor.create("golem/alpine:latest");
const stream = await executor.run(async (ctx) => ctx.runAsStream("while sleep 1; do date; done"));
stream?.on("data", (data) => console.log(data.stdout));
stream?.on("error", () => executor.end());

setTimeout(() => executor.end(), 10_000);
