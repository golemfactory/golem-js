import { DownloadFile, Run, Script, Transfer, UploadFile } from "../script";
import { Activity, Result } from "../activity";
import { StorageProvider } from "../storage/provider";
import { Logger } from "../utils";
import { pipeline, Readable, Transform } from "stream";
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

  transfer(from: string, to: string): Batch {
    this.script.add(new Transfer(from, to));
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
   */
  async end(): Promise<Result[]> {
    await this.script.before();

    try {
      const allResults: Result[] = [];
      const script = this.script.getExeScriptRequest();

      this.logger?.debug(`Sending exec script request to the exe-unit on provider: ${JSON.stringify(script)}`);
      const results = await this.activity.execute(script);

      return new Promise((resolve, reject) => {
        this.logger?.debug("Reading the results of the batch script");

        results.on("data", (res) => {
          this.logger?.debug(`Received data for batch script execution ${JSON.stringify(res)}`);

          allResults.push(res);
        });

        results.on("end", () => {
          this.logger?.debug("End of batch script execution");
          this.script
            .after(allResults)
            .then((results) => resolve(results))
            .catch((error) => reject(error));
        });

        results.on("error", (error) => {
          this.logger?.debug("Error in batch script execution");
          this.script
            .after(allResults)
            .then(() => reject(error))
            .catch(() => reject(error)); // Return original error, as it might be more important.
        });
      });
    } catch (error) {
      this.logger?.error(`Failed to send the exec script to the exe-unit on provider: ${error.toString()}`);
      // NOTE: This is called only to ensure that each of the commands in the original script will be populated with at least `EmptyErrorResult`.
      // That's actually a FIXME, as the command could start with an empty result, which eventually will get replaced with an actual one.
      await this.script.after([]);
      throw error;
    }
  }

  async endStream(): Promise<Readable> {
    const script = this.script;
    await script.before();
    let results: Readable;
    try {
      results = await this.activity.execute(this.script.getExeScriptRequest());
    } catch (error) {
      // the original error is more important than the one from after()
      await script.after([]);
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
    const resultsWithErrorHandling = pipeline(results, errorResultHandler, () => {
      script.after(decodedResults).catch();
    });
    return resultsWithErrorHandling;
  }
}
