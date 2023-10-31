import { RuntimeOptions, GolemRuntime } from "./runtime";
import { WorkContext } from "../task";

export type GolemWorkerOptions = WorkerOptions & RuntimeOptions;
export class GolemWorkerBrowser extends EventTarget {
  private readonly golemRuntime: GolemRuntime;
  private socket?: WebSocket;
  constructor(
    private scriptURL: string | URL,
    options?: GolemWorkerOptions,
  ) {
    super();
    this.golemRuntime = new GolemRuntime(options);
    this.golemRuntime
      .init()
      .then((ctx) => this.init(ctx))
      .catch((error) => this.dispatchEvent(new ErrorEvent(error)));
  }

  on(eventName: string | symbol, listener: (...args: unknown[]) => void): this {
    this.addEventListener(eventName as string, listener);
    return this;
  }

  async init(ctx: WorkContext) {
    console.log(" -------- INIT ---------");
    await this.startWorkerProxy(ctx);
    const websocketUri = ctx.getWebsocketUri(6000);

    console.log(" -------- WS CONNECTED ---------");
    this.socket = new WebSocket(websocketUri);
    this.socket.onmessage = (ev) => this.dispatchEvent(ev);
    this.socket.onerror = (ev) => this.dispatchEvent(ev);
  }

  postMessage(message: unknown) {
    if (!this.socket?.OPEN) {
      console.log("Worker runtime is not ready yet");
      return;
    }
    this.socket.send(message as string);
  }

  terminate() {
    this.golemRuntime.end().catch((error) => console.error(error));
  }
  private async startWorkerProxy(ctx: WorkContext) {
    console.log("start ctx upload", ctx);
    await ctx.uploadFile("./proxy.mjs", "/golem/work/proxy.mjs");
    await ctx.uploadFile("./polyfill.js", "/golem/work/polyfill.js");
    await ctx.uploadFile(`${this.scriptURL}`, "/golem/work/worker.js");
    await ctx.run("node /golem/work/proxy.mjs &");
  }
}
