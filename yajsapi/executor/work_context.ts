import { Activity, Result } from "../activity";
import { Command, Run, Script, Deploy, Start, Terminate } from "../script";
import { Task } from "./task";

interface BatchResult {
  todo: true;
}

export class WorkContextNew {
  private commands: Command[] = [];
  private resultAccepted = false;
  constructor(private activity: Activity, public readonly task: Task) {
    // todo
  }
  async before() {
    const results = await this.activity.execute(new Script([new Deploy(), new Start()]).getExeScriptRequest());
    return new Promise((res, rej) => {
      results.on("data", () => null);
      results.on("end", () => res(1));
      results.on("error", rej);
    });
  }
  async after() {
    // const results = await this.activity.execute(new Script([new Terminate()]).getExeScriptRequest());
    // return new Promise((res, rej) => {
    //   results.on("data", () => null);
    //   results.on("end", () => res(1));
    //   results.on("error", rej);
    // });
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
  async run(...args: Array<string | string[]>): Promise<Result | undefined> {
    const command =
      args.length === 1 ? new Run("/bin/sh", ["-c", <string>args[0]]) : new Run(<string>args[0], <string[]>args[1]);
    const script = new Script([command]);
    const results = await this.activity.execute(script.getExeScriptRequest());
    for await (const result of results[Symbol.asyncIterator]()) {
      return result;
    }
  }
  async end(): Promise<Result> {
    return new Promise((res) => ({} as Result));
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
}
