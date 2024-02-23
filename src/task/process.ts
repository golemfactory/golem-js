import { Readable, Transform } from "stream";
import { Activity, Result } from "../activity";
import { GolemWorkError, WorkErrorCode } from "./error";
import { GolemTimeoutError } from "../error/golem-error";

const DEFAULTS = {
  exitWaitingTimeout: 20_000,
};

/**
 * RemoteProcess class representing the process spawned on the provider by {@link WorkContext.runAndStream}
 */
export class RemoteProcess {
  /**
   * Stream connected to stdout from provider process
   */
  readonly stdout: Readable;
  /**
   * Stream connected to stderr from provider process
   */
  readonly stderr: Readable;

  private lastResult?: Result;

  private streamError?: Error;

  constructor(
    private streamOfActivityResults: Readable,
    private activity: Activity,
  ) {
    this.streamOfActivityResults.on("data", (data) => (this.lastResult = data));
    this.streamOfActivityResults.on("error", (error) => (this.streamError = error));
    const { stdout, stderr } = this.transformResultsStream();
    this.stdout = stdout;
    this.stderr = stderr;
  }

  /**
   * Waits for the process to complete and returns the last part of the command's results as a {@link Result} object.
   * If the timeout is reached, the return promise will be rejected.
   * @param timeout - maximum waiting time im ms for the final result (default: 20_000)
   */
  waitForExit(timeout?: number): Promise<Result> {
    return new Promise((resolve, reject) => {
      const timeoutInMs = timeout ?? DEFAULTS.exitWaitingTimeout;
      const timeoutId = setTimeout(() => {
        reject(
          new GolemWorkError(
            `Unable to get activity results. The waiting time (${timeoutInMs} ms) for the final result has been exceeded`,
            WorkErrorCode.ActivityResultsFetchingFailed,
            this.activity.agreement,
            this.activity,
            this.activity.getProviderInfo(),
            new GolemTimeoutError(`The waiting time (${timeoutInMs} ms) for the final result has been exceeded`),
          ),
        );
        this.activity.stop().catch();
      }, timeoutInMs);
      const end = () => {
        clearTimeout(timeoutId);
        if (this.lastResult) {
          resolve(this.lastResult);
        } else {
          reject(
            new GolemWorkError(
              `An error occurred while retrieving the results. ${this.streamError}`,
              WorkErrorCode.ActivityResultsFetchingFailed,
              this.activity.agreement,
              this.activity,
              this.activity.getProviderInfo(),
            ),
          );
          this.activity.stop().catch();
        }
      };
      if (this.streamOfActivityResults.closed) return end();
      this.streamOfActivityResults.on("close", end);
    });
  }

  private transformResultsStream(): { stdout: Readable; stderr: Readable } {
    const transform = (std: string) =>
      new Transform({
        objectMode: true,
        transform(chunk, encoding, callback) {
          callback(null, chunk?.[std]);
        },
      });
    return {
      stdout: this.streamOfActivityResults.pipe(transform("stdout")),
      stderr: this.streamOfActivityResults.pipe(transform("stderr")),
    };
  }
}
