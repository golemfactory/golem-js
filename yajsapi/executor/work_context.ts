import { Activity, Result } from "../activity";
import { Command, Deploy, DownloadFile, Run, Script, Start, UploadFile } from "../script";
import { StorageProvider } from "../storage/provider";
import { Readable } from "stream";
import { ActivityStateStateEnum } from "ya-ts-client/dist/ya-activity";
import { sleep } from "../utils";

interface BatchResult {
  todo: true;
}

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
  downloadFile(src: string, dst: string) {
    this.script.addCommand(new DownloadFile(this.storageProvider, src, dst));
    return this;
  }
  async end(): Promise<Readable> {
    return this.activity.execute(this.script.getExeScriptRequest());
  }
}

export interface ProviderInfo {
  providerName: string;
  providerId: string;
}

export class WorkContextNew {
  private resultAccepted = false;
  constructor(
    private activity: Activity,
    private storageProvider: StorageProvider,
    private nodeInfo: ProviderInfo,
    private networkNodeInfo: object
  ) {}
  async before(worke): Promise<Result[] | void> {
    let state = await this.activity.getState();
    if (state === ActivityStateStateEnum.Ready) return;
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
  async run(...args: Array<string | string[]>): Promise<Result | undefined> {
    const command =
      args.length === 1 ? new Run("/bin/sh", ["-c", <string>args[0]]) : new Run(<string>args[0], <string[]>args[1]);
    return this.runCommandOnce(command);
  }
  async uploadFile(src: string, dst: string) {
    return this.runCommandOnce(new UploadFile(this.storageProvider, src, dst));
  }
  async uploadJson(dst: string, json: object) {
    throw "Not implemented";
  }
  async downloadFile(src: string, dst: string) {
    return this.runCommandOnce(new DownloadFile(this.storageProvider, src, dst));
  }
  beginBatch() {
    return new Batch(this.activity, this.storageProvider);
  }
  acceptResult(result: unknown) {
    if (!this.resultAccepted) {
      this.task.accept_result(result);
    }
  }
  rejectResult(msg: string) {
    // todo
  }
  log(msg: string) {
    // todo
  }

  private async runCommandOnce(command: Command): Promise<Result | undefined> {
    const script = new Script([command]);
    const results = await this.activity.execute(script.getExeScriptRequest());
    for await (const result of results[Symbol.asyncIterator]()) {
      return result;
    }
  }
}
