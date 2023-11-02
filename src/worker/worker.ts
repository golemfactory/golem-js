import { EventEmitter } from "events";
import { GolemRuntime, RuntimeOptions } from "./runtime";
import { defaultLogger, Logger, nullLogger } from "../utils";
import { WorkContext } from "../task";

export type GolemWorkerOptions = { startupTimeout?: number; websocketConnectionTimeout?: number } & WorkerOptions &
  RuntimeOptions;

export abstract class GolemWorker extends EventEmitter {
  protected readonly options: GolemWorkerOptions;
  protected readonly logger: Logger;
  private readonly golemRuntime: GolemRuntime;

  protected abstract startWebsocket(ctx: WorkContext): Promise<void>;
  protected abstract uploadWorkerFile(ctx: WorkContext): Promise<void>;
  public abstract postMessage(message: unknown): void;
  constructor(
    protected scriptURL: string | URL,
    options?: GolemWorkerOptions,
  ) {
    super();
    this.options = options || ({} as GolemWorkerOptions);
    this.logger = options?.logger || (options?.enableLogging ? defaultLogger() : nullLogger());
    this.options.logger = this.logger;
    this.options.startupTimeout = options?.startupTimeout ?? 20_000;
    this.options.websocketConnectionTimeout = options?.websocketConnectionTimeout ?? 10_000;
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
    try {
      await this.startWorkerProxy(ctx);
      await this.startWebsocket(ctx);
    } catch (error) {
      this.emit("error", error);
    }
  }

  async terminate() {
    return this.golemRuntime.end();
  }
  private async startWorkerProxy(ctx: WorkContext) {
    console.log("uploading...");
    await this.uploadWorkerFile(ctx);
    console.log(await ctx.run("ls -Al /golem/work/"));
    console.log(2222);
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
  protected serializer(message: unknown) {
    if (typeof message !== "string") return JSON.stringify(message);
    return message;
  }
}
