import { Readable, Transform } from "stream";
import { Result } from "../activity";

export class RemoteProcess {
  readonly stdout: Readable;
  readonly stderr: Readable;
  private lastResult?: Result;
  private streamError?: Error;
  private defaultTimeout = 20_000;
  constructor(private streamOfActivityResults: Readable) {
    this.streamOfActivityResults.on("data", (data) => (this.lastResult = data));
    this.streamOfActivityResults.on("error", (error) => (this.streamError = error));
    const { stdout, stderr } = this.transformResultsStream();
    this.stdout = stdout;
    this.stderr = stderr;
  }

  waitForExit(timeout?: number): Promise<Result> {
    return new Promise((res, rej) => {
      const timeoutId = setTimeout(
        () => rej(new Error("The waiting time for the final result has been exceeded")),
        timeout ?? this.defaultTimeout,
      );
      this.streamOfActivityResults.on("close", () => {
        clearTimeout(timeoutId);
        if (this.lastResult) {
          res(this.lastResult);
        } else {
          rej(new Error(`An error occurred while retrieving the results. ${this.streamError}`));
        }
      });
    });
  }

  private transformResultsStream(): { stdout: Readable; stderr: Readable } {
    const stdoutTransform = new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        callback(null, chunk?.stdout ?? null);
      },
    });
    const stderrTransform = new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        callback(null, chunk?.stderr ?? null);
      },
    });
    return {
      stdout: this.streamOfActivityResults.pipe(stdoutTransform),
      stderr: this.streamOfActivityResults.pipe(stderrTransform),
    };
  }
}
