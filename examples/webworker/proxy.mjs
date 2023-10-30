import { createServer } from "net";
import { Worker } from "worker_threads";

const server = createServer({
  keepAlive: true,
  noDelay: true,
});

const worker = new Worker("/golem/work/worker.mjs", { execArgv: ["-r", "/golem/work/polyfill.cjs"] });

server.on("connection", (socket) => {
  try {
    worker.on("message", (msg) => socket.write(`${msg}\r\n`));
    worker.on("error", (error) => console.error(error));
    socket.on("data", (data) => worker.postMessage(deserializer(data)));
    socket.on("error", (error) => console.error(error));
    socket.once("close", () => worker.terminate());
  } catch (error) {
    console.error(error);
    throw error;
  }
});
server.listen(6000, () => console.log("worker proxy started"));

function deserializer(data) {
  try {
    const msg = Buffer.from(data).toString();
    return JSON.parse(msg);
  } catch (e) {
    return data;
  }
}
