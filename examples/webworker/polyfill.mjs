import { parentPort } from "worker_threads";
global.postMessage = (msg) => parentPort.postMessage(msg);
global.addEventListener = (ev, cb) => parentPort.addEventListener(ev, cb);
global.onmessage = () => null;
global.onerror = () => null;
parentPort.addEventListener("message", (ev) => global.onmessage?.(ev));
parentPort.addEventListener("error", (er) => global.onerror?.(er));
