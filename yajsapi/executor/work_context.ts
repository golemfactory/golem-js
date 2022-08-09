import { Activity, Result } from "../activity";
import { Command, Run, Script } from "../script";
import { colonHexadecimalNotationToBinaryString } from "ip-num";

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
    console.log("[CTX RUN]", script.getExeScriptRequest());
    const results = await this.activity.execute(script.getExeScriptRequest()).catch((e) => {
      console.log({ e });
    });
    const batchResults: Result[] = [];
    console.log({ results });
    for await (const result of results[Symbol.asyncIterator]()) {
      console.log("[[CTX RUN RESULT]]", result);
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
