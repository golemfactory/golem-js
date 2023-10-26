import { RuntimeOptions, GolemRuntime } from "./runtime";
import { WorkContext } from "../task";
import WebSocket from "ws";
import { EventEmitter } from "node:events";

export type GolemWorkerOptions = WorkerOptions & RuntimeOptions;

export class GolemWorkerNode extends EventEmitter {
  private readonly golemRuntime: GolemRuntime;
  private socket?: WebSocket;
  constructor(
    private scriptURL: string | URL,
    private options?: GolemWorkerOptions,
  ) {
    super();
    this.addListener("message", (ev) => this["onmessage"]?.(ev));
    this.addListener("error", (ev) => this["onerror"]?.(ev));
    this.golemRuntime = new GolemRuntime(options);
    this.golemRuntime
      .init()
      .then((ctx) => this.init(ctx))
      .catch((error) => this.emit("error", error));
  }

  async init(ctx: WorkContext) {
    await this.startWorkerProxy(ctx);
    const websocketUri = ctx.getWebsocketUri(6000);
    const apiKey = this.options?.yagnaOptions?.apiKey || process.env.YAGNA_APPKEY;
    this.socket = new WebSocket(websocketUri, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    let intervalId;
    this.socket.onopen = () => {
      intervalId = setInterval(() => this.socket!.ping(), 50e3);
      console.log(new Date().toISOString(), `CONNECTED TO PROVIDER: ${ctx.provider?.name}`);
    };
    this.socket.onclose = (ev) => {
      clearInterval(intervalId);
      console.log(new Date().toISOString(), `DISCONNECTED FROM PROVIDER: ${ctx.provider?.name}.`, ev.code);
    };
    this.socket.onmessage = (ev) => this.emit("message", ev.data.toString().trim());
    this.socket.onerror = (er) => this.emit("error", er.error);
  }

  postMessage(message: unknown) {
    if (!this.socket) {
      console.log("Worker runtime is not ready yet");
      return;
    }
    this.socket.send(this.serializer(message));
  }

  terminate() {
    this.golemRuntime.end().catch((error) => console.error(error));
  }
  private async startWorkerProxy(ctx: WorkContext) {
    console.log("starting proxy");
    await ctx.uploadFile("./proxy.mjs", "/golem/work/proxy.mjs");
    await ctx.uploadFile("./polyfill.cjs", "/golem/work/polyfill.cjs");
    await ctx.uploadFile(`${this.scriptURL}`, "/golem/work/worker.js");
    await ctx.run("node /golem/work/proxy.mjs >> /golem/work/log.txt");
    // const logStream = await ctx.runAsStream("tail -f /golem/work/log.txt");
    // logStream.on("data", (data) => console.log(`[LOG] ${data?.json}`));
    // logStream.on("error", (error) => console.log(`ErrorL: ${error}`));
    // logStream.on("end", () => console.log("END"));
    console.log(new Date().toISOString(), "CTX STARTED");
  }

  private serializer(message: unknown) {
    if (typeof message !== "string") return JSON.stringify(message);
    return message;
  }
}
