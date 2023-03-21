import { Activity, Result } from "../activity/index.js";
import { Command, Deploy, DownloadFile, Run, Script, Start, Transfer, UploadFile } from "../script/index.js";
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
  workTimeout: 10000,
  activityStateCheckInterval: 1000,
};

export interface WorkOptions {
  workTimeout?: number;
  activityStateCheckingInterval?: number;
  provider?: { name: string; id: string; networkConfig?: object };
  storageProvider?: StorageProvider;
  networkNode?: NetworkNode;
  logger?: Logger;
  initWorker?: Worker<undefined>;
  isRunning: () => boolean;
}

/**
 * Work Context
 *
 * @description
 */
export class WorkContext {
  public readonly provider?: { name: string; id: string; networkConfig?: object };
  private readonly workTimeout: number;
  private readonly logger?: Logger;
  private readonly activityStateCheckingInterval: number;
  private readonly storageProvider?: StorageProvider;
  private readonly networkNode?: NetworkNode;

  constructor(private activity: Activity, private options?: WorkOptions) {
    this.workTimeout = options?.workTimeout || DEFAULTS.workTimeout;
    this.logger = options?.logger;
    this.activityStateCheckingInterval = options?.activityStateCheckingInterval || DEFAULTS.activityStateCheckInterval;
    this.provider = options?.provider;
    this.storageProvider = options?.storageProvider;
    this.networkNode = options?.networkNode;
  }
  async before(): Promise<Result[] | void> {
    let state = await this.activity.getState();
    if (state === ActivityStateEnum.Ready) {
      if (this.options?.initWorker) await this.options?.initWorker(this, undefined);
      return;
    }
    if (state === ActivityStateEnum.Initialized) {
      await this.activity.execute(
        new Script([new Deploy(this.networkNode?.getNetworkConfig?.()), new Start()]).getExeScriptRequest()
      );
    }
    let timeout = false;
    const timeoutId = setTimeout(() => (timeout = true), this.workTimeout);
    while (state !== ActivityStateEnum.Ready && !timeout && this.options?.isRunning()) {
      await sleep(this.activityStateCheckingInterval, true);
      state = await this.activity.getState();
    }
    clearTimeout(timeoutId);
    if (state !== ActivityStateEnum.Ready) {
      throw new Error(`Activity ${this.activity.id} cannot reach the Ready state. Current state: ${state}`);
    }
    if (this.options?.initWorker) await this.options?.initWorker(this, undefined);
  }
  async run(...args: Array<string | string[]>): Promise<Result> {
    const command =
      args.length === 1 ? new Run("/bin/sh", ["-c", <string>args[0]]) : new Run(<string>args[0], <string[]>args[1]);
    return this.runOneCommand(command);
  }
  async uploadFile(src: string, dst: string): Promise<Result> {
    runtimeContextChecker.checkAndThrowUnsupportedInBrowserError("Upload File");
    return this.runOneCommand(new UploadFile(this.storageProvider!, src, dst));
  }
  async uploadJson(json: object, dst: string): Promise<Result> {
    runtimeContextChecker.checkAndThrowUnsupportedInBrowserError("Upload JSON");
    const src = Buffer.from(JSON.stringify(json), "utf-8");
    return this.runOneCommand(new UploadFile(this.storageProvider!, src, dst));
  }
  async downloadFile(src: string, dst: string): Promise<Result> {
    runtimeContextChecker.checkAndThrowUnsupportedInBrowserError("Download File");
    return this.runOneCommand(new DownloadFile(this.storageProvider!, src, dst));
  }
  beginBatch() {
    return Batch.create(this.activity, this.storageProvider, this.logger);
  }
  rejectResult(msg: string) {
    throw new Error(`Work rejected by user. Reason: ${msg}`);
  }
  getWebsocketUri(port: number): string {
    if (!this.networkNode) throw new Error("There is no network in this work context");
    return this.networkNode?.getWebsocketUri(port);
  }

  private async runOneCommand(command: Command): Promise<Result> {
    const script = new Script([command]);
    await script.before();
    await sleep(100, true);
    const results = await this.activity.execute(script.getExeScriptRequest());
    const allResults: Result[] = [];
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
