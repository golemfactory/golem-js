import { createServer } from "net";
import { Worker } from "worker_threads";
import fs from "fs";

const server = createServer({
  keepAlive: true,
  noDelay: true,
});

const myLogFileStream = fs.createWriteStream("/golem/work/log.txt");

process.stdout.write = process.stderr.write = myLogFileStream.write.bind(myLogFileStream);
server.on("connection", (socket) => {
  const worker = new Worker("/golem/work/worker.js", { execArgv: ["-r", "/golem/work/polyfill.cjs"] });
  worker.on("message", (msg) => socket.write(`${msg}\r\n`));
  worker.on("error", (err) => socket.write(`ERROR: ${err}\r\n`));
  socket.on("data", (data) => worker.postMessage(deserializer(data)));
  socket.once("close", () => worker.terminate());
  socket.on("error", (error) => console.error(error));
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
