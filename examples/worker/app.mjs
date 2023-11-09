// Uncomment this and replace worker to compare the behavior in the native version
// import { Worker } from "worker_threads";
// const worker = new Worker("./worker.js");
import { GolemRuntime } from "@golem-sdk/golem-js";

const golemRuntime = new GolemRuntime({
  minCpuCores: 4,
  enableLogging: true,
});
await golemRuntime.init();
const worker = await golemRuntime.startWorker("./worker.js");

worker.on("message", (msg) => console.log("[worker]", msg));
worker.on("error", (err) => console.log("[worker:error]", err));
worker.on("online", () => console.log("Worker is ready"));
process.stdin.on("data", (data) => worker.postMessage(data.toString().split(",")));
process.once("SIGINT", () => {
  golemRuntime.terminateWorker(worker).then();
  process.once("SIGINT", () => golemRuntime.end());
});
