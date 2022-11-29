import { Activity, Result } from "../activity";
import { Command, Deploy, DownloadFile, Run, Script, Start, UploadFile } from "../script";
import { StorageProvider } from "../storage/provider";
import { ActivityStateStateEnum } from "ya-ts-client/dist/ya-activity";
import { sleep, Logger, runtimeContextChecker } from "../utils";
import { Batch, Task } from "../task";
import { Agreement } from "../agreement";

export type Worker<InputType = unknown, OutputType = unknown> = (
  ctx: WorkContext,
  data: InputType
) => Promise<OutputType | undefined>;

const DEFAULTS = {
  TIMEOUT: 10000,
  ACTIVITY_STATE_CHECKING_INTERVAL: 1000,
};

export interface WorkOptions {
  timeout?: number;
  activityStateCheckingInterval?: number;
  provider: { name: string; id: string; networkConfig?: object };
  storageProvider?: StorageProvider;
  logger?: Logger;
}

export class WorkContext {
  private readonly timeout: number;
  private readonly logger?: Logger;
  private readonly activityStateCheckingInterval: number;
  private readonly provider?: { name: string; id: string; networkConfig?: object };
  private readonly storageProvider?: StorageProvider;
  private resultAccepted = false;
  private resultRejected = false;

  constructor(
    private agreement: Agreement,
    private activity: Activity,
    private task: Task,
    private options?: WorkOptions
  ) {
    this.timeout = options?.timeout || DEFAULTS.TIMEOUT;
    this.logger = options?.logger;
    this.activityStateCheckingInterval =
      options?.activityStateCheckingInterval || DEFAULTS.ACTIVITY_STATE_CHECKING_INTERVAL;
    this.provider = options?.provider;
    this.storageProvider = options?.storageProvider;
  }
  async before(): Promise<Result[] | void> {
    const worker = this.task.getInitWorker();
    let state = await this.activity.getState();
    if (state === ActivityStateStateEnum.Ready) {
      if (worker) await worker(this, undefined);
      return;
    }
    if (state === ActivityStateStateEnum.Initialized) {
      await this.activity.execute(
        new Script([new Deploy(this.provider?.networkConfig), new Start()]).getExeScriptRequest()
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
    if (worker) {
      await worker(this, undefined);
    }
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
  acceptResult(results: Result[]) {
    if (!this.resultAccepted) this.task.stop(results);
    this.resultAccepted = true;
  }
  rejectResult(msg: string) {
    if (!this.resultRejected && !this.resultAccepted) this.task.stop(undefined, new Error(msg), true);
    this.resultRejected = true;
    this.resultAccepted = true;
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
