async function main() {
  const worker = new GolemWorker();

  await worker.register("worker.js");

  worker.addEventListener("data", (event) => console.log(event.stdout));
  worker.onmessage((msg) => console.log(msg.data));

  worker.postMessage("start");
  worker.postMessage("stop");
  worker.postMessage({ action: "execute_something", args: { input1: "one" } });

  worker.terminate();
}
