// import { Worker } from "worker_threads";
import { Worker } from "@golem-sdk/golem-js";

const worker = new Worker("./worker.js", { enableLogging: true });
worker.on("message", (msg) => console.log("[worker]", msg));
worker.on("error", (err) => console.log("[worker:error]", err));
worker.on("online", () => console.log("Worker is ready"));
process.stdin.on("data", (data) => worker.postMessage(data.toString().split(",")));
process.once("SIGINT", () => worker.terminate());
