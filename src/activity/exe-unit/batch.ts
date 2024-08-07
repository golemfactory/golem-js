import { DownloadFile, Run, Script, Transfer, UploadData, UploadFile } from "../script";
import { Result } from "../index";
import { StorageProvider } from "../../shared/storage";
import { Logger } from "../../shared/utils";
import { GolemWorkError, WorkErrorCode } from "./error";

import { ExeScriptExecutor, ScriptExecutionMetadata } from "../exe-script-executor";
import { Observable, finalize, map, tap } from "rxjs";

export class Batch {
  private readonly script: Script;

  constructor(
    private executor: ExeScriptExecutor,
    private storageProvider: StorageProvider,
    private logger: Logger,
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

      this.logger.debug(`Sending exec script request to the exe-unit on provider:`, { script });
      const executionMetadata = await this.executor.execute(script);
      const result$ = this.executor.getResultsObservable(executionMetadata);

      return new Promise((resolve, reject) => {
        this.logger.debug("Reading the results of the batch script");

        result$.subscribe({
          next: (res) => {
            this.logger.debug(`Received data for batch script execution`, { res });
            allResults.push(res);
          },
          complete: () => {
            this.logger.debug("End of batch script execution");
            this.script
              .after(allResults)
              .then((results) => resolve(results))
              .catch((error) => reject(error));
          },
          error: (error) => {
            const golemError =
              error instanceof GolemWorkError
                ? error
                : new GolemWorkError(
                    `Unable to execute script ${error}`,
                    WorkErrorCode.ScriptExecutionFailed,
                    this.executor.activity.agreement,
                    this.executor.activity,
                    this.executor.activity.agreement.provider,
                    error,
                  );
            this.logger.debug("Error in batch script execution", { error });
            this.script
              .after(allResults)
              .then(() => reject(golemError))
              .catch(() => reject(golemError)); // Return original error, as it might be more important.
          },
        });
      });
    } catch (error) {
      this.logger.error(`Failed to send the exec script to the exe-unit on provider`, { error });
      // NOTE: This is called only to ensure that each of the commands in the original script will be populated with at least `EmptyErrorResult`.
      // That's actually a FIXME, as the command could start with an empty result, which eventually will get replaced with an actual one.
      await this.script.after([]);
      if (error instanceof GolemWorkError) {
        throw error;
      }
      throw new GolemWorkError(
        `Unable to execute script ${error}`,
        WorkErrorCode.ScriptExecutionFailed,
        this.executor.activity.agreement,
        this.executor.activity,
        this.executor.activity.agreement.provider,
        error,
      );
    }
  }

  async endStream(): Promise<Observable<Result>> {
    const script = this.script;
    await script.before();
    let executionMetadata: ScriptExecutionMetadata;
    try {
      executionMetadata = await this.executor.execute(this.script.getExeScriptRequest());
    } catch (error) {
      // the original error is more important than the one from after()
      await script.after([]);
      if (error instanceof GolemWorkError) {
        throw error;
      }
      throw new GolemWorkError(
        `Unable to execute script ${error}`,
        WorkErrorCode.ScriptExecutionFailed,
        this.executor.activity.agreement,
        this.executor.activity,
        this.executor.activity.agreement.provider,
        error,
      );
    }
    const decodedResults: Result[] = [];
    const { activity } = this.executor;
    const result$ = this.executor.getResultsObservable(executionMetadata);
    return result$.pipe(
      map((chunk) => {
        if (chunk.result !== "Error") {
          return chunk;
        }
        throw new GolemWorkError(
          `${chunk?.message}. Stdout: ${String(chunk?.stdout).trim()}. Stderr: ${String(chunk?.stderr).trim()}`,
          WorkErrorCode.ScriptExecutionFailed,
          activity.agreement,
          activity,
          activity.provider,
        );
      }),
      tap((chunk) => {
        decodedResults.push(chunk);
      }),
      finalize(() =>
        script.after(decodedResults).catch((error) => this.logger.error("Failed to cleanup script", { error })),
      ),
    );
  }
}
