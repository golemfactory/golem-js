import { DownloadFile, Run, Script, UploadFile } from "../script/index.js";
import { Activity, Result } from "../activity/index.js";
import { StorageProvider } from "../storage/provider.js";
import { Logger, sleep } from "../utils/index.js";
import { Readable, Transform } from "stream";
import { UploadData } from "../script/command.js";

export class Batch {
  private script: Script;

  static create(activity: Activity, storageProvider: StorageProvider, logger?: Logger): Batch {
    return new Batch(activity, storageProvider, logger);
  }

  constructor(private activity: Activity, private storageProvider: StorageProvider, private logger?: Logger) {
    this.script = new Script([]);
  }

  run(...args: Array<string | string[]>): Batch {
    this.script.add(
      args.length === 1 ? new Run("/bin/sh", ["-c", <string>args[0]]) : new Run(<string>args[0], <string[]>args[1])
    );
    return this;
  }

  uploadFile(src: string, dst: string): Batch {
    this.script.add(new UploadFile(this.storageProvider, src, dst));
    return this;
  }

  uploadJson(json: object, dst: string): Batch {
    const src = new TextEncoder().encode(JSON.stringify(json));
    this.script.add(new UploadData(this.storageProvider, src, dst));
    return this;
  }

  uploadData(data: Uint8Array, dst: string): Batch {
    this.script.add(new UploadData(this.storageProvider, data, dst));
    return this;
  }

  downloadFile(src: string, dst: string): Batch {
    this.script.add(new DownloadFile(this.storageProvider, src, dst));
    return this;
  }

  async end(): Promise<Result[]> {
    await this.script.before();
    await sleep(100, true);
    const results = await this.activity.execute(this.script.getExeScriptRequest());
    const allResults: Result[] = [];
    return new Promise((resolve, reject) => {
      results.on("data", (result) => {
        allResults.push(result);
        if (result.result === "Error") {
          this.script.after(allResults).catch();
          return reject(`Error: ${result.message}`);
        }
      });

      results.on("end", () => {
        this.script.after(allResults)
          .then(results => resolve(results))
          .catch(error => reject(error));
      });

      results.on("error", (error) => {
        this.script.after(allResults)
          .then(() => reject(error))
          .catch(() => reject(error)); // Return original error, as it might be more important.
      });
    });
  }

  async endStream(): Promise<Readable> {
    const script = this.script;
    await script.before();
    const results = await this.activity.execute(this.script.getExeScriptRequest());
    const decodedResults: Result[] = [];
    const errorResultHandler = new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        const error =
          chunk?.result === "Error"
            ? new Error(`${chunk?.message}. Stdout: ${chunk?.stdout?.trim()}. Stderr: ${chunk?.stderr?.trim()}`)
            : null;
        if (error) {
          script.after(decodedResults).catch();
          this.destroy(error);
        } else {
          decodedResults.push(chunk);
          // FIXME: This is broken, chunk result didn't go through after() at this point yet, it might be incomplete.
          callback(null, chunk);
        }
      },
    });
    results.on("end", () => this.script.after(decodedResults).catch());
    results.on("error", (error) => {
      script.after(decodedResults).catch();
      results.destroy(error);
    });
    return results.pipe(errorResultHandler);
  }
}
