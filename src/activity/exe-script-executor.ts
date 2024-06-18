import { createAbortSignalFromTimeout, Logger } from "../shared/utils";
import { ExecutionConfig } from "./config";
import { Readable } from "stream";
import { GolemWorkError, WorkErrorCode } from "./work";
import { withTimeout } from "../shared/utils/timeout";
import { GolemAbortError } from "../shared/error/golem-error";
import retry from "async-retry";
import { Result, StreamingBatchEvent } from "./results";
import sleep from "../shared/utils/sleep";
import { Activity } from "./activity";
import { getMessageFromApiError } from "../shared/utils/apiErrorMessage";
import { ActivityModule } from "./activity.module";

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
   * Execute script
   *
   * @param script - exe script request
   * @param stream - define type of getting results from execution (polling or streaming)
   * @param signalOrTimeout - the timeout in milliseconds or an AbortSignal that will be used to cancel the execution
   * @param maxRetries - maximum number of retries retrieving results when an error occurs, default: 10
   */
  public async execute(
    script: ExeScriptRequest,
    stream?: boolean,
    signalOrTimeout?: number | AbortSignal,
    maxRetries?: number,
  ): Promise<Readable> {
    let batchId: string, batchSize: number;
    const abortController = new AbortController();
    // abort execution in case of cancellation by global signal or by local signal (from parameter)
    this.abortSignal.addEventListener("abort", () => abortController.abort(this.abortSignal.reason));
    if (signalOrTimeout) {
      const abortSignal = createAbortSignalFromTimeout(signalOrTimeout);
      abortSignal.addEventListener("abort", () => abortController.abort(abortSignal.reason));
    }

    try {
      abortController.signal.throwIfAborted();
      batchId = await this.send(script);
      batchSize = JSON.parse(script.text).length;

      abortController.signal.throwIfAborted();
      this.logger.debug(`Script sent.`, { batchId });

      return stream
        ? this.streamingBatch(batchId, batchSize, abortController.signal)
        : this.pollingBatch(batchId, abortController.signal, maxRetries);
    } catch (error) {
      const message = getMessageFromApiError(error);

      this.logger.error("Execution of script failed.", {
        reason: message,
      });

      if (abortController.signal.aborted) {
        throw new GolemAbortError("Executions of script has been aborted", this.abortSignal.reason);
      }
      throw new GolemWorkError(
        `Unable to execute script. ${message}`,
        WorkErrorCode.ScriptExecutionFailed,
        this.activity.agreement,
        this.activity,
        this.activity.getProviderInfo(),
        error,
      );
    }
  }

  protected async send(script: ExeScriptRequest): Promise<string> {
    return withTimeout(this.activityModule.executeScript(this.activity, script), 10_000);
  }

  private async pollingBatch(batchId: string, abortSignal: AbortSignal, maxRetries?: number): Promise<Readable> {
    this.logger.debug("Starting to poll for batch results");

    let isBatchFinished = false;
    let lastIndex: number;

    const { id: activityId, agreement } = this.activity;

    const { activityExeBatchResultPollIntervalSeconds, activityExeBatchResultMaxRetries } = this.options;
    const { logger, activity, activityModule } = this;

    return new Readable({
      objectMode: true,
      async read() {
        const abortError = new GolemAbortError("Execution of script has been aborted", abortSignal.reason);
        abortSignal.addEventListener("abort", () => {
          logger.warn(abortError.message, { activityId: activity.id, batchId, reason: abortSignal.reason });
          this.destroy(abortError);
        });
        while (!isBatchFinished && !abortSignal.aborted) {
          logger.debug("Polling for batch script execution result");

          try {
            const results = await retry(
              async (bail, attempt) => {
                logger.debug(`Trying to poll for batch execution results from yagna. Attempt: ${attempt}`);
                try {
                  if (abortSignal.aborted) {
                    return bail(abortError);
                  }
                  return await activityModule.getBatchResults(
                    activity,
                    batchId,
                    undefined,
                    activityExeBatchResultPollIntervalSeconds,
                  );
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

            const newResults = results && results.slice(lastIndex + 1);

            logger.debug(`Received batch execution results`, { results: newResults, activityId });

            if (Array.isArray(newResults) && newResults.length) {
              newResults.forEach((result) => {
                this.push(result);
                isBatchFinished = result.isBatchFinished || false;
                lastIndex = result.index;
              });
            }
          } catch (error) {
            if (abortSignal.aborted) {
              return this.destroy(abortError);
            }
            logger.error(`Processing script execution results failed`, error);

            return this.destroy(
              error instanceof GolemWorkError
                ? error
                : new GolemWorkError(
                    `Unable to get activity results. ${error}`,
                    WorkErrorCode.ActivityResultsFetchingFailed,
                    agreement,
                    activity,
                    activity.getProviderInfo(),
                    error,
                  ),
            );
          }
        }
        if (abortSignal.aborted) {
          return this.destroy(abortError);
        }
        this.push(null);
      },
    });
  }

  private async streamingBatch(batchId: string, batchSize: number, abortSignal: AbortSignal): Promise<Readable> {
    const errors: object[] = [];
    const results: Result[] = [];

    const source = this.activityModule.observeStreamingBatchEvents(this.activity, batchId).subscribe({
      next: (resultEvents) => results.push(this.parseEventToResult(resultEvents, batchSize)),
      error: (err) => errors.push(err.data?.message ?? err),
      complete: () => this.logger.debug("Finished reading batch results"),
    });

    let isBatchFinished = false;

    const { logger, activity } = this;

    return new Readable({
      objectMode: true,
      async read() {
        const abortError = new GolemAbortError("Execution of script has been aborted", abortSignal.reason);
        abortSignal.addEventListener("abort", () => {
          logger.warn(abortError.message, { activityId: activity.id, batchId, reason: abortSignal.reason });
          this.destroy(abortError);
        });
        while (!isBatchFinished && !abortSignal.aborted) {
          let error: Error | undefined;

          if (abortSignal.aborted) {
            error = abortError;
          }

          if (errors.length) {
            error = new GolemWorkError(
              `Unable to get activity results. ${JSON.stringify(errors)}`,
              WorkErrorCode.ActivityResultsFetchingFailed,
              activity.agreement,
              activity,
              activity.getProviderInfo(),
            );
          }
          if (error) {
            source.unsubscribe();
            return this.destroy(error);
          }

          if (results.length) {
            const result = results.shift();
            this.push(result);
            isBatchFinished = result?.isBatchFinished || false;
          }
          await sleep(500, true);
        }
        if (abortSignal.aborted) {
          this.destroy(abortError);
          return;
        } else {
          this.push(null);
        }
        source.unsubscribe();
      },
    });
  }

  private parseEventToResult(event: StreamingBatchEvent, batchSize: number): Result {
    // StreamingBatchEvent has a slightly more extensive structure,
    // including a return code that could be added to the Result entity... (?)
    return new Result({
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
  }
}
