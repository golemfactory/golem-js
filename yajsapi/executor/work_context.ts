import { Activity, Result } from "../activity";
import { Command, Deploy, DownloadFile, Run, Script, Start, UploadFile } from "../script";
import { StorageProvider } from "../storage/provider";
import { ActivityStateStateEnum } from "ya-ts-client/dist/ya-activity";
import { Worker } from "./golem";
import { sleep, logger } from "../utils";
import { Task } from "./task";
import { Readable } from "stream";

class Batch {
  private script: Script;
  constructor(private activity: Activity, private storageProvider: StorageProvider) {
    this.script = new Script([]);
  }
  run(...args: Array<string | string[]>) {
    this.script.addCommand(
      args.length === 1 ? new Run("/bin/sh", ["-c", <string>args[0]]) : new Run(<string>args[0], <string[]>args[1])
    );
    return this;
  }
  uploadFile(src: string, dst: string) {
    this.script.addCommand(new UploadFile(this.storageProvider, src, dst));
    return this;
  }
  uploadJson(json: object, dst: string) {
    const src = Buffer.from(JSON.stringify(json), "utf-8");
    this.script.addCommand(new UploadFile(this.storageProvider, src, dst));
    return this;
  }
  downloadFile(src: string, dst: string) {
    this.script.addCommand(new DownloadFile(this.storageProvider, src, dst));
    return this;
  }
  async end(): Promise<Result[]> {
    await this.script.before();
    const results = await this.activity.execute(this.script.getExeScriptRequest());
    const allResults: Result[] = [];
    return new Promise((res, rej) => {
      results.on("data", (res) => allResults.push(res));
      results.on("end", () => {
        this.script.after();
        res(allResults);
      });
      results.on("error", (error) => {
        this.script.after();
        rej(error);
      });
    });
  }
  async endStream(): Promise<Readable> {
    await this.script.before();
    const results = await this.activity.execute(this.script.getExeScriptRequest());
    results.on("end", () => this.script.after());
    results.on("error", (error) => {
      this.script.after();
      results.destroy(error);
    });
    return results;
  }
}

export interface ProviderInfo {
  providerName: string;
  providerId: string;
}

export class WorkContextNew {
  private resultAccepted = false;
  private resultRejected = false;
  constructor(
    private activity: Activity,
    private storageProvider: StorageProvider,
    private nodeInfo: ProviderInfo,
    private networkNodeInfo: object,
    private task: Task<"D", "R">
  ) {}
  async before(worker?: Worker): Promise<Result[] | void> {
    let state = await this.activity.getState();
    if (state === ActivityStateStateEnum.Ready) {
      if (worker) await worker(this, null);
      return;
    }
    if (state === ActivityStateStateEnum.Initialized) {
      await this.activity.execute(new Script([new Deploy(this.networkNodeInfo), new Start()]).getExeScriptRequest());
    }
    let timeout = false;
    setTimeout(() => (timeout = true), 10000);
    while (state !== ActivityStateStateEnum.Ready || !timeout) {
      await sleep(2);
      state = await this.activity.getState();
    }
    if (state !== ActivityStateStateEnum.Ready) {
      throw new Error(`Activity ${this.activity.id} can't be ready`);
    }
    if (worker) {
      await worker(this, null);
    }
  }
  async after(): Promise<void> {
    // todo
  }
  async beforeEach() {
    // todo
  }
  async afterEach() {
    // todo
  }
  async run(...args: Array<string | string[]>): Promise<Result> {
    const command =
      args.length === 1 ? new Run("/bin/sh", ["-c", <string>args[0]]) : new Run(<string>args[0], <string[]>args[1]);
    return this.runOneCommand(command);
  }
  async uploadFile(src: string, dst: string): Promise<Result> {
    return this.runOneCommand(new UploadFile(this.storageProvider, src, dst));
  }
  async uploadJson(json: object, dst: string): Promise<Result> {
    const src = Buffer.from(JSON.stringify(json), "utf-8");
    return this.runOneCommand(new UploadFile(this.storageProvider, src, dst));
  }
  async downloadFile(src: string, dst: string): Promise<Result> {
    return this.runOneCommand(new DownloadFile(this.storageProvider, src, dst));
  }
  beginBatch() {
    return new Batch(this.activity, this.storageProvider);
  }
  acceptResult(result: unknown) {
    if (!this.resultAccepted) this.task.accept_result(result as "R");
    this.resultAccepted = true;
  }
  rejectResult(msg: string) {
    if (!this.resultRejected) this.task.reject_result(msg, true);
    this.resultRejected = true;
    this.resultAccepted = true;
  }
  log(msg: string) {
    logger.info(`[${this.nodeInfo.providerName}] ${msg}`);
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
      this.rejectResult(`Task error on provider ${this.nodeInfo.providerName}. ${errorMessage}`);
      throw new Error(errorMessage);
    }
    return allResults[0];
  }
}
