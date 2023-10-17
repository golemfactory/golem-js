import { createServer } from "net";
import { Worker } from "worker_threads";

const server = createServer();
server.on("connection", (socket) => {
  const worker = new Worker("/golem/work/worker.js", { execArgv: ["-r", "/golem/work/polyfill.cjs"] });
  worker.on("online", () => {
    console.log("Worker online");
    worker.on("message", (msg) => socket.write(`${msg}\r\n`));
    worker.on("error", (err) => socket.write(`${err}\r\n`));
    socket.on("data", (data) => console.log(data));
    // socket.on('data', data =>  worker.postMessage(deserializer(data)));
    socket.once("close", () => worker.terminate());
  });
});
server.listen(6000);

function deserializer(data) {
  try {
    const msg = Buffer.from(data).toString();
    return JSON.parse(msg);
  } catch (e) {
    return msg;
  }
}
