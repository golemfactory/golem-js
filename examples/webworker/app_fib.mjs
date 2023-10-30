import { Worker } from "@golem-sdk/golem-js";
import os from "os";

const min = 30;
const max = 45;
const length = os.cpus().length;
const dataSet = Array.from({ length }, () => Math.floor(Math.random() * (max - min + 1) + min));

process.setMaxListeners(length + 3);
let completedWorkers = new Set();

const workers = Array.from({ length }, (_, i) => {
  const worker = new Worker("./worker_fib.js");
  worker.on("message", (msg) => {
    console.log(`[worker-${i}]`, msg);
    completedWorkers.add(i);
    if (completedWorkers.size === length) {
      const stopTime = new Date().valueOf();
      console.log(`\nComputation finished in ${((stopTime - startTime) / 1000).toFixed(0)} sec`);
    }
    worker.terminate();
  });
  worker.on("error", (error) => {
    completedWorkers.add(i);
    console.error(`[worker-${i}]`, error);
    worker.terminate();
  });
  return worker;
});

console.log(`Calculating the fibo number for a set: ${dataSet}\n`);
const startTime = new Date().valueOf();
workers.forEach((worker, i) =>
  worker.on("online", () => {
    worker.postMessage(dataSet[i]);
  }),
);

process.once("SIGINT", () =>
  workers.forEach((worker, i) => {
    if (!completedWorkers.has(1)) worker.terminate();
  }),
);
