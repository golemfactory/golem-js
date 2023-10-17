import { GolemWorker } from "@golem-sdk/golem-js";

const worker = new GolemWorker("./worker2.js");
worker.on("message", (msg) => console.log("WORKER MSG", msg));

process.stdin.on("data", (data) => worker.postMessage(data.toString().trim().split(",")));
process.once("SIGINT", () => worker.terminate());
