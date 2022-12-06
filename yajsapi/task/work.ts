import { Activity, Result } from "../activity";
import { Command, Deploy, DownloadFile, Run, Script, Start, UploadFile } from "../script";
import { StorageProvider } from "../storage/provider";
import { ActivityStateStateEnum } from "ya-ts-client/dist/ya-activity";
import { sleep, Logger, runtimeContextChecker } from "../utils";
import { Batch } from "../task";
import { NetworkNode } from "../network/node";

export type Worker<InputType = unknown, OutputType = unknown> = (
  ctx: WorkContext,
  data?: InputType
) => Promise<OutputType | undefined>;

const DEFAULTS = {
  timeout: 10000,
  activityStateCheckInterval: 1000,
};

export interface WorkOptions {
  timeout?: number;
  activityStateCheckingInterval?: number;
  provider?: { name: string; id: string; networkConfig?: object };
  storageProvider?: StorageProvider;
  networkNode?: NetworkNode;
  logger?: Logger;
  initWorker?: Worker<undefined>;
}

export class WorkContext {
  private readonly timeout: number;
  private readonly logger?: Logger;
  private readonly activityStateCheckingInterval: number;
  private readonly provider?: { name: string; id: string; networkConfig?: object };
  private readonly storageProvider?: StorageProvider;
  private readonly networkNode?: NetworkNode;

  constructor(private activity: Activity, private options?: WorkOptions) {
    this.timeout = options?.timeout || DEFAULTS.timeout;
    this.logger = options?.logger;
    this.activityStateCheckingInterval = options?.activityStateCheckingInterval || DEFAULTS.activityStateCheckInterval;
    this.provider = options?.provider;
    this.storageProvider = options?.storageProvider;
    this.networkNode = options?.networkNode;
  }
  async before(): Promise<Result[] | void> {
    let state = await this.activity.getState();
    if (state === ActivityStateStateEnum.Ready) {
      if (this.options?.initWorker) await this.options?.initWorker(this, undefined);
      return;
    }
    if (state === ActivityStateStateEnum.Initialized) {
      await this.activity.execute(
        new Script([new Deploy(this.networkNode?.getNetworkConfig()), new Start()]).getExeScriptRequest()
      );
    }
    let timeout = false;
    const timeoutId = setTimeout(() => (timeout = true), this.timeout);
    while (state !== ActivityStateStateEnum.Ready && !timeout) {
      await sleep(this.activityStateCheckingInterval, true);
      state = await this.activity.getState();
    }
    clearTimeout(timeoutId);
    if (state !== ActivityStateStateEnum.Ready) {
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
