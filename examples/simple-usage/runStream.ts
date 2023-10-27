import { TaskExecutor } from "@golem-sdk/golem-js";

const executor = await TaskExecutor.create("golem/alpine:latest");
const results = await executor.run(async (ctx) => ctx.runAndStream("while sleep 1; do date; done"));
results?.on("data", (data) => console.log(data.stdout));
results?.on("error", () => executor.end());

setTimeout(() => executor.end(), 10_000);
