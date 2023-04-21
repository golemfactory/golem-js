import { Activity, Result } from "../activity/index.js";
import { Capture, Command, Deploy, DownloadFile, Run, Script, Start, UploadFile } from "../script/index.js";
import { StorageProvider } from "../storage/index.js";
import { ActivityStateEnum } from "../activity/index.js";
import { sleep, Logger, runtimeContextChecker } from "../utils/index.js";
import { Batch } from "./index.js";
import { NetworkNode } from "../network/index.js";

export type Worker<InputType = unknown, OutputType = unknown> = (
  ctx: WorkContext,
  data?: InputType
) => Promise<OutputType | undefined>;

const DEFAULTS = {
  activityPreparingTimeout: 300_000,
  activityStateCheckInterval: 1000,
};

export interface WorkOptions {
  activityPreparingTimeout?: number;
  activityStateCheckingInterval?: number;
  provider?: { name: string; id: string; networkConfig?: object };
  storageProvider?: StorageProvider;
  networkNode?: NetworkNode;
  logger?: Logger;
  initWorker?: Worker<undefined>;
  isRunning: () => boolean;
}

interface CommandOptions {
  timeout?: number;
  env?: object;
  capture?: Capture;
}

/**
 * Work Context
 *
 * @description
 */
export class WorkContext {
  public readonly provider?: { name: string; id: string; networkConfig?: object };
  public readonly agreementId: string;
  public readonly activityId: string;
  private readonly activityPreparingTimeout: number;
  private readonly logger?: Logger;
  private readonly activityStateCheckingInterval: number;
  private readonly storageProvider?: StorageProvider;
  private readonly networkNode?: NetworkNode;

  constructor(private activity: Activity, private options?: WorkOptions) {
    this.agreementId = this.activity.agreementId;
    this.activityId = this.activity.id;
    this.activityPreparingTimeout = options?.activityPreparingTimeout || DEFAULTS.activityPreparingTimeout;
    this.logger = options?.logger;
    this.activityStateCheckingInterval = options?.activityStateCheckingInterval || DEFAULTS.activityStateCheckInterval;
    this.provider = options?.provider;
    this.storageProvider = options?.storageProvider;
    this.networkNode = options?.networkNode;
  }
  async before(): Promise<Result[] | void> {
    let state = await this.activity.getState().catch((e) => this.logger?.debug(e));
    if (state === ActivityStateEnum.Ready) {
      if (this.options?.initWorker) await this.options?.initWorker(this, undefined);
      return;
    }
    if (state === ActivityStateEnum.Initialized) {
      const result = await this.activity
        .execute(
          new Script([new Deploy(this.networkNode?.getNetworkConfig?.()), new Start()]).getExeScriptRequest(),
          undefined,
          this.activityPreparingTimeout
        )
        .catch((e) => {
          throw new Error(`Unable to deploy activity. ${e}`);
        });
      let timeoutId;
      await Promise.race([
        new Promise(
          (res, rej) => (timeoutId = setTimeout(() => rej("Preparing activity timeout"), this.activityPreparingTimeout))
        ),
        new Promise((res, rej) => {
          result.on("data", () => null);
          result.on("close", res);
          result.on("error", rej);
        }),
      ]).finally(() => clearTimeout(timeoutId));
    }
    await sleep(this.activityStateCheckingInterval, true);
    state = await this.activity.getState().catch((e) => this.logger?.warn(`${e} Provider: ${this.provider?.name}`));
    if (state !== ActivityStateEnum.Ready) {
      throw new Error(`Activity ${this.activity.id} cannot reach the Ready state. Current state: ${state}`);
    }
    if (this.options?.initWorker) await this.options?.initWorker(this, undefined);
  }
  async run(...args: Array<string | string[] | CommandOptions>): Promise<Result> {
    const options: CommandOptions | undefined =
      typeof args?.[1] === "object" ? <CommandOptions>args?.[1] : <CommandOptions>args?.[2];
    const command =
      args.length === 1
        ? new Run("/bin/sh", ["-c", <string>args[0]], options?.env, options?.capture)
        : new Run(<string>args[0], <string[]>args[1], options?.env, options?.capture);

    return this.runOneCommand(command, options);
  }
  async uploadFile(src: string, dst: string, options?: CommandOptions): Promise<Result> {
    runtimeContextChecker.checkAndThrowUnsupportedInBrowserError("Upload File");
    return this.runOneCommand(new UploadFile(this.storageProvider!, src, dst), options);
  }
  async uploadJson(json: object, dst: string, options?: CommandOptions): Promise<Result> {
    runtimeContextChecker.checkAndThrowUnsupportedInBrowserError("Upload JSON");
    const src = Buffer.from(JSON.stringify(json), "utf-8");
    return this.runOneCommand(new UploadFile(this.storageProvider!, src, dst), options);
  }
  async downloadFile(src: string, dst: string, options?: CommandOptions): Promise<Result> {
    runtimeContextChecker.checkAndThrowUnsupportedInBrowserError("Download File");
    return this.runOneCommand(new DownloadFile(this.storageProvider!, src, dst), options);
  }
  beginBatch() {
    return Batch.create(this.activity, this.storageProvider, this.logger);
  }
  rejectResult(msg: string) {
    throw new Error(`Work rejected. Reason: ${msg}`);
  }
  getWebsocketUri(port: number): string {
    if (!this.networkNode) throw new Error("There is no network in this work context");
    return this.networkNode?.getWebsocketUri(port);
  }

  async getState(): Promise<ActivityStateEnum> {
    return this.activity.getState();
  }

  private async runOneCommand(command: Command, options?: CommandOptions): Promise<Result> {
    const script = new Script([command]);
    await script.before().catch((e) => {
      throw new Error(
        `Script initialization failed for command: ${JSON.stringify(command.toJson())}. ${
          e?.response?.data?.message || e?.message || e
        }`
      );
    });
    await sleep(100, true);
    const results = await this.activity.execute(script.getExeScriptRequest(), false, options?.timeout).catch((e) => {
      throw new Error(
        `Script execution failed for command: ${JSON.stringify(command.toJson())}. ${
          e?.response?.data?.message || e?.message || e
        }`
      );
    });
    const allResults: Result[] = [];
    // await new Promise((res, rej) => {
    //   results.on("data", (data) => allResults.push(data));
    //   results.on("error", (error) =>
    //     rej(`Task error on provider while getting results ${this.provider?.name}. ${error}`)
    //   );
    //   results.on("close", () => res(true));
    // });
    for await (const result of results) allResults.push(result);
    const commandsErrors = allResults.filter((res) => res.result === "Error");
    await script.after();
    if (commandsErrors.length) {
      const errorMessage = commandsErrors
        .map((err) => `Error: ${err.message}. Stdout: ${err.stdout?.trim()}. Stderr: ${err.stderr?.trim()}`)
        .join(". ");
      this.rejectResult(`Task error on provider ${this.provider?.name || "'unknown'"}. ${errorMessage}`);
      throw new Error(errorMessage);
    }
    return allResults[0];
  }
}
