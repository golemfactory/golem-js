import { createServer } from "net";
import { Worker } from "worker_threads";

const server = createServer({
  keepAlive: true,
  noDelay: true,
});

const worker = new Worker("/golem/proxy/worker.mjs", { execArgv: ["-r", "/golem/proxy/polyfill.cjs"] });

server.on("connection", (socket) => {
  try {
    worker.on("message", (msg) => socket.write(serialize(msg)));
    worker.on("error", (error) => console.error(error));
    socket.on("data", (data) => worker.postMessage(deserialize(data)));
    socket.on("error", (error) => console.error(error));
    socket.once("close", () => worker.terminate());
  } catch (error) {
    console.error(error);
    throw error;
  }
});
server.listen(6000, () => console.log("worker proxy started"));

function deserialize(data) {
  try {
    const msg = Buffer.from(data).toString();
    return JSON.parse(msg);
  } catch (e) {
    console.error("Deserialize error:", e);
    return data;
  }
}

function serialize(msg) {
  try {
    const data = JSON.stringify(msg);
    return Buffer.from(data);
  } catch (e) {
    console.error("Serialize error:", e);
    return msg;
  }
}
