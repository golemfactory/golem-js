import { DownloadFile, Run, Script, UploadFile } from "../script/index.js";
import { Activity, Result } from "../activity/index.js";
import { StorageProvider } from "../storage/provider.js";
import { Logger, runtimeContextChecker } from "../utils/index.js";
import { Readable, Transform } from "stream";

export class Batch {
  private script: Script;
  static create(activity: Activity, storageProvider?: StorageProvider, logger?: Logger): Batch {
    return new Batch(activity, storageProvider, logger);
  }
  constructor(private activity: Activity, private storageProvider?: StorageProvider, private logger?: Logger) {
    this.script = new Script([]);
  }
  run(...args: Array<string | string[]>) {
    this.script.add(
      args.length === 1 ? new Run("/bin/sh", ["-c", <string>args[0]]) : new Run(<string>args[0], <string[]>args[1])
    );
    return this;
  }
  uploadFile(src: string, dst: string) {
    runtimeContextChecker.checkAndThrowUnsupportedInBrowserError("Upload File");
    this.script.add(new UploadFile(this.storageProvider!, src, dst));
    return this;
  }
  uploadJson(json: object, dst: string) {
    runtimeContextChecker.checkAndThrowUnsupportedInBrowserError("Upload JSON");
    const src = Buffer.from(JSON.stringify(json), "utf-8");
    this.script.add(new UploadFile(this.storageProvider!, src, dst));
    return this;
  }
  downloadFile(src: string, dst: string) {
    runtimeContextChecker.checkAndThrowUnsupportedInBrowserError("Download File");
    this.script.add(new DownloadFile(this.storageProvider!, src, dst));
    return this;
  }
  async end(): Promise<Result[]> {
    await this.script.before();
    const results = await this.activity.execute(this.script.getExeScriptRequest());
    const allResults: Result[] = [];
    return new Promise((res, rej) => {
      results.on("data", (res) => {
        allResults.push(res);
        if (res.result === "Error") {
          this.script.after();
          return rej(allResults);
        }
      });
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
    const script = this.script;
    await script.before();
    const results = await this.activity.execute(this.script.getExeScriptRequest());
    const errorResultHandler = new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        const error =
          chunk?.result === "Error"
            ? new Error(`${chunk?.message}. Stdout: ${chunk?.stdout?.trim()}. Stderr: ${chunk?.stderr?.trim()}`)
            : null;
        if (error) {
          script.after();
          this.destroy(error);
        } else callback(null, chunk);
      },
    });
    results.on("end", () => this.script.after());
    results.on("error", (error) => {
      script.after();
      results.destroy(error);
    });
    return results.pipe(errorResultHandler);
  }
}
