async function main() {
  const worker = new GolemWorker();

  // const worker = new GolemWorker({
  //   packege: "xx",
  //   budget: "1",
  // });

  await worker.register("script.js");

  worker.addEventListener("data", (event) => console.log(event.stdout));

  // TODO: ????? (Service API)
  worker.postMessage("start");
  worker.postMessage("stop");
  worker.postMessage({ action: "execute_something", args: { input1: "one" } });
}
