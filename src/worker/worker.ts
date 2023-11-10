import { EventEmitter } from "events";
import { defaultLogger, Logger, nullLogger } from "../utils";
import { WorkContext } from "../task";
import { YagnaOptions } from "../utils/yagna/yagna";

export type GolemWorkerOptions = {
  startupTimeout?: number;
  websocketConnectionTimeout?: number;
  logger?: Logger;
  enableLogging?: boolean;
  yagna: YagnaOptions;
} & WorkerOptions;

export abstract class GolemWorker extends EventEmitter {
  protected readonly options: GolemWorkerOptions;
  protected readonly logger: Logger;

  protected abstract startWebsocket(ctx: WorkContext): Promise<void>;
  protected abstract uploadWorkerFile(ctx: WorkContext): Promise<void>;
  public abstract postMessage(message: unknown): void;
  constructor(
    public readonly ctx: WorkContext,
    protected scriptURL: string | URL,
    options?: GolemWorkerOptions,
  ) {
    super();
    this.options = options || ({} as GolemWorkerOptions);
    this.logger = options?.logger || (options?.enableLogging ? defaultLogger() : nullLogger());
    this.options.logger = this.logger;
    this.options.startupTimeout = options?.startupTimeout ?? 60_000;
    this.options.websocketConnectionTimeout = options?.websocketConnectionTimeout ?? 10_000;
    this.addListener("message", (ev) => this["onmessage"]?.(ev));
    this.addListener("error", (ev) => this["onerror"]?.(ev));
    this.init(ctx).catch((error) => this.emit("error", error));
  }

  async init(ctx: WorkContext) {
    try {
      await this.startWorkerProxy(ctx);
      await this.startWebsocket(ctx);
      this.emit("online");
      this.logger.info("Golem Worker started");
    } catch (error) {
      this.logger.error(`Golem Worker initialization error. ${error}`);
      this.emit("error", error);
    }
  }

  terminate() {
    this.emit("end");
  }
  private async startWorkerProxy(ctx: WorkContext) {
    await this.uploadWorkerFile(ctx);
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
   * A very primitive json serializer
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected serializer(message: any) {
    if (typeof message !== "string") return JSON.stringify(message);
    return message;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected deserializer(data: any) {
    try {
      const msg = Buffer.from(data).toString();
      return JSON.parse(msg);
    } catch (e) {
      this.logger.error(`Unable to deserialize data from worker. Data: ${data}. ${e}`);
      throw e;
    }
  }
}
