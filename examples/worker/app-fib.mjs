// import { Worker } from "worker_threads";
import { GolemRuntime } from "@golem-sdk/golem-js";
import os from "os";

const min = 30;
const max = 42;
const length = os.cpus().length;
const dataSet = Array.from({ length }, () => Math.floor(Math.random() * (max - min + 1) + min));

process.setMaxListeners(length + 3);
let completedWorkers = new Set();

const golemRuntime = new GolemRuntime({
  enableLogging: true,
});
await golemRuntime.init();

console.log(`Calculating the fibo number for a set: ${dataSet}\n`);
const startTime = new Date().valueOf();

Promise.all(
  Array.from({ length }, (_, i) => {
    // const worker = new Worker("./worker-fib.js");
    return golemRuntime.startWorker("./worker-fib.js").then((worker) => {
      worker.on("message", (msg) => {
        console.log(`[worker-${i}]`, msg);
        completedWorkers.add(i);
        if (completedWorkers.size === length) {
          const stopTime = new Date().valueOf();
          console.log(`\nComputation finished in ${((stopTime - startTime) / 1000).toFixed(0)} sec`);
          golemRuntime.end().then(() => process.exit(0));
        }
        golemRuntime.terminateWorker(worker).then();
      });
      worker.on("error", (error) => {
        completedWorkers.add(i);
        console.error(`[worker-${i}]`, error);
        golemRuntime.terminateWorker(worker).then();
      });
      worker.on("online", () => {
        worker.postMessage(dataSet[i]);
      });
      return worker;
    });
  }),
).catch(console.error);

process.once("SIGINT", () => golemRuntime.end());
