import { createAbortSignalFromTimeout, Logger } from "../shared/utils";
import { ExecutionConfig } from "./config";
import { Readable } from "stream";
import { GolemWorkError, WorkErrorCode } from "./work";
import { withTimeout } from "../shared/utils/timeout";
import { GolemAbortError, GolemTimeoutError } from "../shared/error/golem-error";
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
  /** timeout for sending and creating batch */
  activityRequestTimeout?: number;
  /** timeout for executing batch */
  activityExecuteTimeout?: number;
  /** interval for fetching batch results while polling */
  activityExeBatchResultPollIntervalSeconds?: number;
  /** maximum number of retries retrieving results when an error occurs, default: 10 */
  activityExeBatchResultMaxRetries?: number;
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
   * @param timeout - execution timeout
   * @param maxRetries - maximum number of retries retrieving results when an error occurs, default: 10
   */
  public async execute(
    script: ExeScriptRequest,
    stream?: boolean,
    timeout?: number,
    maxRetries?: number,
  ): Promise<Readable> {
    let batchId: string, batchSize: number;
    let startTime = new Date();

    try {
      this.abortSignal.throwIfAborted();
      batchId = await this.send(script);
      startTime = new Date();
      batchSize = JSON.parse(script.text).length;

      this.abortSignal.throwIfAborted();
      this.logger.debug(`Script sent.`, { batchId });

      return stream
        ? this.streamingBatch(batchId, batchSize, startTime, timeout)
        : this.pollingBatch(batchId, startTime, timeout, maxRetries);
    } catch (error) {
      const message = getMessageFromApiError(error);

      this.logger.error("Execution of script failed.", {
        reason: message,
      });

      throw new GolemWorkError(
        `Unable to execute script ${message}`,
        WorkErrorCode.ScriptExecutionFailed,
        this.activity.agreement,
        this.activity,
        this.activity.getProviderInfo(),
        error,
      );
    }
  }

  protected async send(script: ExeScriptRequest): Promise<string> {
    return withTimeout(this.activityModule.executeScript(this.activity, script), this.options.activityRequestTimeout);
  }

  private async pollingBatch(
    batchId: string,
    startTime: Date,
    timeout?: number,
    maxRetries?: number,
  ): Promise<Readable> {
    this.logger.debug("Starting to poll for batch results");

    let isBatchFinished = false;
    let lastIndex: number;

    const { id: activityId, agreement } = this.activity;

    const { activityExecuteTimeout, activityExeBatchResultPollIntervalSeconds, activityExeBatchResultMaxRetries } =
      this.options;
    const { logger, activity, activityModule, abortSignal } = this;

    return new Readable({
      objectMode: true,

      async read() {
        abortSignal.addEventListener("abort", () =>
          this.destroy(new GolemAbortError(`Processing of batch execution has been aborted`, abortSignal.reason)),
        );
        while (!isBatchFinished && !abortSignal.aborted) {
          logger.debug("Polling for batch script execution result");

          if (startTime.valueOf() + (timeout || activityExecuteTimeout) <= new Date().valueOf()) {
            logger.debug("Activity probably timed-out, will stop polling for batch execution results");
            return this.destroy(new GolemTimeoutError(`Activity ${activityId} timeout.`));
          }

          try {
            const results = await retry(
              async (bail, attempt) => {
                logger.debug(`Trying to poll for batch execution results from yagna. Attempt: ${attempt}`);
                try {
                  if (abortSignal.aborted) {
                    logger.debug("Activity is no longer running, will stop polling for batch execution results");
                    return bail(
                      new GolemAbortError(`Activity ${activityId} has been interrupted.`, abortSignal.reason),
                    );
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
              const message = "Processing of batch execution has been aborted";
              logger.warn(message, { reason: abortSignal.reason });
              return this.destroy(new GolemAbortError(message, abortSignal.reason));
            }
            logger.error(`Processing batch execution results failed`, error);

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
          this.destroy(new GolemAbortError(`Processing of batch execution has been aborted`, abortSignal.reason));
        } else {
          this.push(null);
        }
      },
    });
  }

  private async streamingBatch(
    batchId: string,
    batchSize: number,
    startTime: Date,
    timeout?: number,
  ): Promise<Readable> {
    const errors: object[] = [];
    const results: Result[] = [];

    const source = this.activityModule.observeStreamingBatchEvents(this.activity, batchId).subscribe({
      next: (resultEvents) => results.push(this.parseEventToResult(resultEvents, batchSize)),
      error: (err) => errors.push(err.data?.message ?? err),
      complete: () => this.logger.debug("Finished reading batch results"),
    });

    let isBatchFinished = false;
    const activityExecuteTimeout = this.options.activityExecuteTimeout;

    const { logger, activity, abortSignal } = this;

    return new Readable({
      objectMode: true,
      async read() {
        while (!isBatchFinished) {
          let error: Error | undefined;
          if (startTime.valueOf() + (timeout || activityExecuteTimeout) <= new Date().valueOf()) {
            logger.debug("Activity probably timed-out, will stop streaming batch execution results");
            error = new GolemTimeoutError(`Activity ${activity.id} timeout.`);
          }

          if (abortSignal.aborted) {
            logger.debug("Activity is no longer running, will stop streaming batch execution results");
            error = new GolemAbortError(`Processing of batch execution has been aborted`, abortSignal.reason);
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
          this.destroy(new GolemAbortError(`Processing of batch execution has been aborted`, abortSignal.reason));
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
