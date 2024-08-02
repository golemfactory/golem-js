import { Activity, ActivityModule, Result } from "../index";
import { GolemWorkError, WorkErrorCode } from "./error";
import { GolemTimeoutError } from "../../shared/error/golem-error";
import { Logger } from "../../shared/utils";
import { finalize, Observable, Subject, Subscription } from "rxjs";

const DEFAULTS = {
  exitWaitingTimeout: 20_000,
};

/**
 * RemoteProcess class representing the process spawned on the provider by {@link ExeUnit.runAndStream}
 */
export class RemoteProcess {
  /**
   * Stream connected to stdout from provider process
   */
  readonly stdout: Subject<Result["stdout"]> = new Subject();
  /**
   * Stream connected to stderr from provider process
   */
  readonly stderr: Subject<Result["stderr"]> = new Subject();

  private lastResult?: Result;

  private streamError?: Error;

  private subscription: Subscription;

  constructor(
    private readonly activityModule: ActivityModule,
    activityResult$: Observable<Result>,
    private activity: Activity,
    private readonly logger: Logger,
  ) {
    this.subscription = activityResult$
      .pipe(
        finalize(() => {
          this.stdout.complete();
          this.stderr.complete();
        }),
      )
      .subscribe({
        next: (result) => {
          this.lastResult = result;
          if (result.stdout) this.stdout.next(result.stdout);
          if (result.stderr) this.stderr.next(result.stderr);
        },
        error: (error) => {
          this.streamError = error;
        },
      });
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
            this.activity.provider,
            new GolemTimeoutError(`The waiting time (${timeoutInMs} ms) for the final result has been exceeded`),
          ),
        );
        this.activityModule
          .destroyActivity(this.activity)
          .catch((err) => this.logger.error(`Error when destroying activity`, err));
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
              this.activity.provider,
            ),
          );
          this.activityModule
            .destroyActivity(this.activity)
            .catch((err) => this.logger.error(`Error when destroying activity`, err));
        }
      };
      this.subscription.add(() => end());
    });
  }

  /**
   * Checks if the exe-script batch from Yagna has completed, reflecting all work and streaming to be completed
   */
  isFinished() {
    return this.subscription.closed;
  }
}
