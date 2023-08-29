import { DownloadFile, Run, Script, UploadFile } from "../script";
import { Activity, Result } from "../activity";
import { StorageProvider } from "../storage/provider";
import { Logger, sleep } from "../utils";
import { Readable, Transform } from "stream";
import { UploadData } from "../script/command";

export class Batch {
  private script: Script;

  static create(activity: Activity, storageProvider: StorageProvider, logger?: Logger): Batch {
    return new Batch(activity, storageProvider, logger);
  }

  constructor(
    private activity: Activity,
    private storageProvider: StorageProvider,
    private logger?: Logger,
  ) {
    this.script = new Script([]);
  }

  /**
   * Execute a command on provider using a shell (/bin/sh).
   *
   * @param commandLine Shell command to execute.
   */
  run(commandLine: string): Batch;

  /**
   * Execute an executable on provider.
   *
   * @param executable Executable to run.
   * @param args Executable arguments.
   */
  run(executable: string, args: string[]): Batch;

  run(executableOrCommand: string, executableArgs?: string[]): Batch {
    if (executableArgs) {
      this.script.add(new Run(executableOrCommand, executableArgs));
    } else {
      this.script.add(new Run("/bin/sh", ["-c", executableOrCommand]));
    }
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

  /**
   * Executes the batch of commands added via {@link run} returning result for each of the steps.
   *
   * In case any of the commands will fail, the execution of the batch will be interrupted by the Provider.
   */
  async end(): Promise<Result[]> {
    await this.script.before();
    await sleep(100, true);
    let results: Readable;
    try {
      results = await this.activity.execute(this.script.getExeScriptRequest());
    } catch (error) {
      // the original error is more important than the one from after()
      await this.script.after([]).catch();
      throw error;
    }
    const allResults: Result[] = [];
    return new Promise((resolve, reject) => {
      results.on("data", (res) => {
        allResults.push(res);
      });

      results.on("end", () => {
        this.script
          .after(allResults)
          .then((results) => resolve(results))
          .catch((error) => reject(error));
      });

      results.on("error", (error) => {
        this.script
          .after(allResults)
          .then(() => reject(error))
          .catch(() => reject(error)); // Return original error, as it might be more important.
      });
    });
  }

  async endStream(): Promise<Readable> {
    const script = this.script;
    await script.before();
    let results: Readable;
    try {
      results = await this.activity.execute(this.script.getExeScriptRequest());
    } catch (error) {
      // the original error is more important than the one from after()
      await script.after([]).catch();
      throw error;
    }
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
