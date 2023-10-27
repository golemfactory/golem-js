import { parentPort } from "worker_threads";
parentPort.addEventListener("message", (e) => {
  const n = Number(e.data);
  if (isNaN(n) || n < 1) {
    parentPort.postMessage("Invalid number");
  } else {
    parentPort.postMessage(`Fib(${n}) = ${fib(n)}`);
  }
});

function fib(n) {
  if (n === 0) {
    return 0;
  } else if (n === 1 || n === 2) {
    return 1;
  } else {
    return fib(n - 1) + fib(n - 2);
  }
}
