import { createServer } from "net";
import { Worker } from "worker_threads";

const server = createServer({
  keepAlive: true,
  noDelay: true,
});
server.on("connection", (socket) => {
  const worker = new Worker("./worker2.js", { execArgv: ["-r", "./polyfill.cjs"] });
  worker.on("message", (msg) => socket.write(`${msg}\r\n`));
  worker.on("error", (err) => socket.write(`${err}\r\n`));
  socket.on("data", function (data) {
    worker.postMessage([2, 3]);
    // socket.write(`MSG FROM PROXY: ${data}\r\n`);
    return 1;
  });
  socket.once("close", () => worker.terminate());
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
