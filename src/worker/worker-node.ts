import { RuntimeOptions, GolemRuntime } from "./runtime";
import { WorkContext } from "../task";
import WebSocket from "ws";
import { EventEmitter } from "node:events";
import { defaultLogger, Logger, nullLogger } from "../utils";

export type GolemWorkerOptions = { startupTimeout?: number } & WorkerOptions & RuntimeOptions;

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
    this.logger = options?.logger || (options?.enableLogging ? defaultLogger() : nullLogger());
    this.options.logger = this.logger;
    this.options.startupTimeout = options?.startupTimeout ?? 20_000;
    this.addListener("message", (ev) => this["onmessage"]?.(ev));
    this.addListener("error", (ev) => this["onerror"]?.(ev));
    // TODO: change to official golem image
    this.options.imageTag = "mgordel/worker:latest";
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
    await ctx.uploadFile(`${this.scriptURL}`, "/golem/work/worker.mjs");
    const results = await ctx.runAndStream("node /golem/proxy/proxy.mjs");
    results.on("error", (error) => this.logger.debug(error));
    await new Promise((res, rej) => {
      const timeoutId = setTimeout(() => rej(new Error("Worker Proxy startup timed out")), this.options.startupTimeout);
      results.on("data", (data) => {
        // consider another way to check if the proxy is ready.
        // For now, after a successful start, proxy write the following message
        // to the console: "worker proxy started"
        if (data.stdout && data.stdout.trim() === "worker proxy started") {
          clearTimeout(timeoutId);
          return res(true);
        }
        if (data.stdout) console.log(data.stdout.trim());
        if (data.stderr) console.log(data.stderr.trim());
      });
    });
    this.logger.debug(`Worker Proxy started on provider ${ctx.provider?.name}`);
  }

  /**
   * A very primitive json serializer, requires testing and verification on other edge cases...
   */
  private serializer(message: unknown) {
    if (typeof message !== "string") return JSON.stringify(message);
    return message;
  }
}
