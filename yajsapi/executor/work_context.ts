import { Activity, Result } from "../activity";
import { Command, Run, Script } from "../script";

interface BatchResult {
  todo: true;
}

export class WorkContextNew {
  private commands: Command[] = [];
  constructor(private activity: Activity) {
    // todo
  }
  async before() {
    console.log("BEFORE NEW CTX");
  }
  async after() {
    console.log("AFTER NEW CTX");
  }
  beginBatch() {
    // todo
    return this;
  }
  sendFile(src: string, dst: string) {
    // todo
    return this;
  }
  sendJson(dst: string, json: object) {
    // todo;
    return this;
  }
  downloadFile(src: string, dst: string) {
    // todo
    return this;
  }
  async run(command: string): Promise<Result[]> {
    const script = new Script([new Run("/bin/sh", ["-c", command])]);
    const results = await this.activity.execute(script.getExeScriptRequest());
    const batchResults: Result[] = [];
    for await (const result of results[Symbol.asyncIterator]()) {
      batchResults.push(result);
    }
    return batchResults;
  }
  async end(): Promise<Result> {
    return new Promise((res) => ({} as Result));
  }
  async acceptResult(msg: string) {
    // todo
  }
  async rejectResult(msg: string) {
    // todo
  }
}
