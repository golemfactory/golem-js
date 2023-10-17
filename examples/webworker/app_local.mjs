import { Worker } from "worker_threads";

const worker = new Worker("./worker2.js", { execArgv: ["-r", "./polyfill.cjs"] });
worker.on("message", (msg) => console.log("WORKER MSG", msg));
process.stdin.on("data", (data) => worker.postMessage(data.toString().trim().split(",")));
process.once("SIGINT", () => worker.terminate());
