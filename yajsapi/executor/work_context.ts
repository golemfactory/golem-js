import { Result } from "../activity";

export class WorkContext {
  constructor() {
    // todo
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
    // todo
    return this;
  }
  downloadFile(src: string, dst: string) {
    // todo
    return this;
  }
  run(script: string) {
    // todo
    return this;
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
