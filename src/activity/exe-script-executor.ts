import {
  anyAbortSignal,
  createAbortSignalFromTimeout,
  Logger,
  mergeUntilFirstComplete,
  runOnNextEventLoopIteration,
} from "../shared/utils";
import { ExecutionConfig } from "./config";
import { GolemWorkError, WorkErrorCode } from "./exe-unit";
import { withTimeout } from "../shared/utils/timeout";
import { GolemAbortError } from "../shared/error/golem-error";
import retry from "async-retry";
import { Result, StreamingBatchEvent } from "./results";
import { Activity } from "./activity";
import { getMessageFromApiError } from "../shared/utils/apiErrorMessage";
import { ActivityModule } from "./activity.module";
import { catchError, map, Observable, takeWhile } from "rxjs";

/**
 * Information needed to fetch the results of a script execution
 */
export interface ScriptExecutionMetadata {
  batchId: string;
  batchSize: number;
}

export interface ExeScriptRequest {
  text: string;
}

export interface ExecutionOptions {
  /** interval for fetching batch results while polling */
  activityExeBatchResultPollIntervalSeconds?: number;
  /** maximum number of retries retrieving results when an error occurs, default: 10 */
  activityExeBatchResultMaxRetries?: number;
  /** The timeout in milliseconds or an AbortSignal that will be used to cancel the execution */
  signalOrTimeout?: number | AbortSignal;
}

const RETRYABLE_ERROR_STATUS_CODES = [408, 500];

export class ExeScriptExecutor {
  private readonly options: ExecutionConfig;
  private readonly abortSignal: AbortSignal;

  constructor(
    public readonly activity: Activity,
    private readonly activityModule: ActivityModule,
    private readonly logger: Logger,
    options?: ExecutionOptions,
  ) {
    this.options = new ExecutionConfig(options);
    this.abortSignal = createAbortSignalFromTimeout(options?.signalOrTimeout);
  }

  /**
   * Executes the provided script and returns the batch id and batch size that can be used
   * to fetch it's results
   * @param script
   * @returns script execution metadata - batch id and batch size that can be used to fetch results using `getResultsObservable`
   */
  public async execute(script: ExeScriptRequest): Promise<ScriptExecutionMetadata> {
    try {
      this.abortSignal.throwIfAborted();
      const batchId = await this.send(script);
      const batchSize = JSON.parse(script.text).length;

      this.logger.debug(`Script sent.`, { batchId, script });
      return { batchId, batchSize };
    } catch (error) {
      const message = getMessageFromApiError(error);

      this.logger.error("Execution of script failed.", {
        reason: message,
      });

      if (this.abortSignal.aborted) {
        throw new GolemAbortError("Executions of script has been aborted", this.abortSignal.reason);
      }
      throw new GolemWorkError(
        `Unable to execute script. ${message}`,
        WorkErrorCode.ScriptExecutionFailed,
        this.activity.agreement,
        this.activity,
        this.activity.provider,
        error,
      );
    }
  }

  /**
   * Given a batch id and batch size collect the results from yagna. You can choose to either
   * stream them as they go or poll for them. When a timeout is reached (by either the timeout provided
   * as an argument here or in the constructor) the observable will emit an error.
   *
   *
   * @param batch - batch id and batch size
   * @param stream - define type of getting results from execution (polling or streaming)
   * @param signalOrTimeout - the timeout in milliseconds or an AbortSignal that will be used to cancel the execution
   * @param maxRetries - maximum number of retries retrieving results when an error occurs, default: 10
   */
  public getResultsObservable(
    batch: ScriptExecutionMetadata,
    stream?: boolean,
    signalOrTimeout?: number | AbortSignal,
    maxRetries?: number,
  ): Observable<Result> {
    const signal = anyAbortSignal(this.abortSignal, createAbortSignalFromTimeout(signalOrTimeout));

    // observable that emits when the script execution should be aborted
    const abort$ = new Observable<never>((subscriber) => {
      const getError = () => new GolemAbortError("Execution of script has been aborted", signal.reason);

      if (signal.aborted) {
        subscriber.error(getError());
      }
      signal.addEventListener("abort", () => {
        subscriber.error(getError());
      });
    });

    // get an observable that will emit results of a batch execution
    const results$ = stream
      ? this.streamingBatch(batch.batchId, batch.batchSize)
      : this.pollingBatch(batch.batchId, maxRetries);

    return mergeUntilFirstComplete(abort$, results$);
  }

  protected async send(script: ExeScriptRequest): Promise<string> {
    return withTimeout(this.activityModule.executeScript(this.activity, script), 10_000);
  }

  private pollingBatch(batchId: string, maxRetries?: number): Observable<Result> {
    let isCompleted = false;
    let lastIndex: number;

    const { id: activityId, agreement } = this.activity;

    const { activityExeBatchResultPollIntervalSeconds, activityExeBatchResultMaxRetries } = this.options;
    const { logger, activity, activityModule } = this;

    return new Observable<Result>((subscriber) => {
      const pollForResults = async (): Promise<void> => {
        if (isCompleted) {
          subscriber.complete();
          return;
        }
        logger.debug("Polling for batch script execution result");

        await retry(
          async (bail, attempt) => {
            logger.debug(`Trying to poll for batch execution results from yagna. Attempt: ${attempt}`);
            try {
              if (isCompleted) {
                bail(new Error("Batch is finished"));
              }
              const results = await activityModule.getBatchResults(
                activity,
                batchId,
                undefined,
                activityExeBatchResultPollIntervalSeconds,
              );

              const newResults = results && results.slice(lastIndex + 1);

              logger.debug(`Received batch execution results`, { results: newResults, activityId });

              if (Array.isArray(newResults) && newResults.length) {
                newResults.forEach((result) => {
                  subscriber.next(result);
                  isCompleted ||= !!result.isBatchFinished;
                  lastIndex = result.index;
                });
              }
            } catch (error) {
              logger.debug(`Failed to fetch activity results. Attempt: ${attempt}. ${error}`);
              if (RETRYABLE_ERROR_STATUS_CODES.includes(error?.status)) {
                throw error;
              } else {
                bail(error);
              }
            }
          },
          {
            retries: maxRetries ?? activityExeBatchResultMaxRetries,
            maxTimeout: 15_000,
          },
        );
        return runOnNextEventLoopIteration(pollForResults);
      };

      pollForResults().catch((error) => {
        logger.error(`Polling for batch results failed`, error);
        subscriber.error(error);
      });
      return () => {
        isCompleted = true;
      };
    }).pipe(
      catchError((error) => {
        if (error instanceof GolemWorkError) {
          throw error;
        }
        throw new GolemWorkError(
          `Unable to get activity results. ${error}`,
          WorkErrorCode.ActivityResultsFetchingFailed,
          agreement,
          activity,
          activity.provider,
          error,
        );
      }),
    );
  }

  private streamingBatch(batchId: string, batchSize: number): Observable<Result> {
    return this.activityModule.observeStreamingBatchEvents(this.activity, batchId).pipe(
      map((resultEvents) => this.parseEventToResult(resultEvents, batchSize)),
      takeWhile((result) => !result.isBatchFinished, true),
      // transform to domain error
      catchError((error) => {
        throw new GolemWorkError(
          `Unable to get activity results. ${error}`,
          WorkErrorCode.ActivityResultsFetchingFailed,
          this.activity.agreement,
          this.activity,
          this.activity.provider,
          error,
        );
      }),
    );
  }

  private parseEventToResult(event: StreamingBatchEvent, batchSize: number): Result {
    // StreamingBatchEvent has a slightly more extensive structure,
    // including a return code that could be added to the Result entity... (?)
    const result = new Result({
      index: event.index,
      eventDate: event.timestamp,
      result: event?.kind?.finished
        ? event?.kind?.finished?.return_code === 0
          ? "Ok"
          : "Error"
        : event?.kind?.stderr
          ? "Error"
          : "Ok",
      stdout: event?.kind?.stdout,
      stderr: event?.kind?.stderr,
      message: event?.kind?.finished?.message,
      isBatchFinished: event.index + 1 >= batchSize && Boolean(event?.kind?.finished),
    });

    this.logger.debug("Received stream batch execution result", { result });

    return result;
  }
}
