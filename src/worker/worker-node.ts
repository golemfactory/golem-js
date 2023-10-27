import { RuntimeOptions, GolemRuntime } from "./runtime";
import { WorkContext } from "../task";
import WebSocket from "ws";
import { EventEmitter } from "node:events";
import { defaultLogger, Logger, nullLogger } from "../utils";

export type GolemWorkerOptions = WorkerOptions & RuntimeOptions;

export class GolemWorkerNode extends EventEmitter {
  private readonly golemRuntime: GolemRuntime;
  private socket?: WebSocket;
  private readonly options: GolemWorkerOptions;
  private readonly logger: Logger;
  constructor(
    private scriptURL: string | URL,
    options?: GolemWorkerOptions,
  ) {
    super();
    this.options = options || ({} as GolemWorkerOptions);
    this.logger = options?.logger || options?.enableLogging ? defaultLogger() : nullLogger();
    this.options.logger = this.logger;
    this.addListener("message", (ev) => this["onmessage"]?.(ev));
    this.addListener("error", (ev) => this["onerror"]?.(ev));
    this.golemRuntime = new GolemRuntime(this.options);
    this.golemRuntime
      .init()
      .then((ctx) => this.init(ctx))
      .catch((error) => this.emit("error", error));
  }

  async init(ctx: WorkContext) {
    await this.startWorkerProxy(ctx).catch((error) => this.emit("error", error));
    const websocketUri = ctx.getWebsocketUri(6000);
    const apiKey = this.options?.yagnaOptions?.apiKey || process.env.YAGNA_APPKEY;
    this.socket = new WebSocket(websocketUri, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    let intervalId;
    this.socket.onmessage = (ev) => this.emit("message", ev.data.toString().trim());
    this.socket.onerror = (er) => this.emit("error", er.error);
    this.socket.onopen = () => {
      intervalId = setInterval(() => this.socket!.ping(), 50e3);
      this.logger.debug(`Websocket opened on provider ${ctx.provider?.name}`);
      this.emit("online");
    };
    this.socket.onclose = (ev) => {
      clearInterval(intervalId);
      this.logger.debug(`Websocket closed. Code: ${ev.code}`);
    };
  }

  postMessage(message: unknown) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      this.logger.log("Worker runtime is not ready. Current state: " + this.socket?.readyState);
      return;
    }
    this.socket.send(this.serializer(message));
  }

  async terminate() {
    return this.golemRuntime.end();
  }
  private async startWorkerProxy(ctx: WorkContext) {
    await ctx.uploadFile("./proxy.mjs", "/golem/work/proxy.mjs");
    await ctx.uploadFile("./polyfill.cjs", "/golem/work/polyfill.cjs");
    await ctx.uploadFile(`${this.scriptURL}`, "/golem/work/worker.mjs");
    // await ctx.run("node /golem/work/proxy.mjs &");
    const results = await ctx.runAndStream("node /golem/work/proxy.mjs");
    results.on("data", (data) => {
      if (data.stdout) console.log(data.stdout.trim());
      if (data.stderr) console.log(data.stderr.trim());
    });
    results.on("error", (error) => this.logger.debug(error));
    await new Promise((res) => setTimeout(res, 3_000));
    this.logger.debug(`Worker Proxy started on provider ${ctx.provider?.name}`);
  }

  private serializer(message: unknown) {
    if (typeof message !== "string") return JSON.stringify(message);
    return message;
  }
}
