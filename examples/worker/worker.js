import { parentPort } from "worker_threads";
console.log("Please write two numbers:");
parentPort.addEventListener("message", (e) => {
  console.log("Message received from main script");
  const a = Number(e.data[0]);
  const b = Number(e.data[1]);
  if (isNaN(a) || isNaN(b)) {
    parentPort.postMessage("Invalid numbers");
  } else {
    console.log("Posting message back to main script");
    parentPort.postMessage(`${a} + ${b} = ${a + b}`);
  }
});
