import { Result, StreamingBatchEvent } from "./results";
import {
  ActivityStateStateEnum as ActivityStateEnum,
  ExeScriptRequest,
} from "ya-ts-client/dist/ya-activity/src/models";
import { RequestorControlApi, RequestorStateApi } from "ya-ts-client/dist/ya-activity/api";
import { yaActivity } from "ya-ts-client";
import EventSource from "eventsource";
import { Readable } from "stream";
import { Logger } from "../utils";
import sleep from "../utils/sleep";
import CancellationToken from "../utils/cancellationToken";
import { ActivityFactory } from "./factory";

export interface ActivityOptions {
  yagnaOptions?: { apiKey?: string; basePath?: string };
  requestTimeout?: number;
  executeTimeout?: number;
  exeBatchResultsFetchInterval?: number;
  logger?: Logger;
  taskPackage?: string;
}

export { ActivityStateEnum };

export class Activity {
  private readonly logger?: Logger;
  protected readonly requestTimeout: number;
  private readonly executeTimeout: number;
  private readonly exeBatchResultsFetchInterval: number;

  /**
   * Create activity for given agreement ID
   * @param agreementId
   * @param options - ActivityOptions
   * @param options.yagnaOptions.apiKey - Yagna Api Key
   * @param options.yagnaOptions.basePath - Yagna base path to Activity REST Api
   * @param options.requestTimeout - timeout for sending and creating batch
   * @param options.executeTimeout - timeout for executing batch
   * @param options.exeBatchResultsFetchInterval - interval for fetching batch results while polling
   * @param options.logger - logger module
   * @param options.taskPackage
   * @param secure - defines if activity will be secure type
   */
  static async create(agreementId: string, options?: ActivityOptions, secure = false): Promise<Activity> {
    const factory = new ActivityFactory(agreementId, options);
    return factory.create(secure);
  }

  constructor(
    public readonly id,
    protected readonly api: { control: RequestorControlApi; state: RequestorStateApi },
    protected readonly options?: ActivityOptions
  ) {
    this.requestTimeout = options?.requestTimeout || 10000;
    this.executeTimeout = options?.executeTimeout || 240000;
    this.exeBatchResultsFetchInterval = options?.exeBatchResultsFetchInterval || 3000;
    this.logger = options?.logger;
  }

  /**
   * Execute script
   * @param script - exe script request
   * @param stream - define type of getting results from execution (polling or streaming)
   * @param timeout - execution timeout
   * @param cancellationToken - token for interrupting activity
   */
  public async execute(
    script: ExeScriptRequest,
    stream?: boolean,
    timeout?: number,
    cancellationToken?: CancellationToken
  ): Promise<Readable> {
    let batchId, batchSize;
    let startTime = new Date();
    try {
      batchId = await this.send(script);
      startTime = new Date();
      batchSize = JSON.parse(script.text).length;
    } catch (error) {
      this.logger?.error(error);
      throw new Error(error?.response?.data?.message || error);
    }
    return stream
      ? this.streamingBatch(batchId, batchSize, startTime, timeout, cancellationToken)
      : this.pollingBatch(batchId, startTime, timeout, cancellationToken);
  }

  /**
   * Stop and destroy activity
   */
  public async stop(): Promise<boolean> {
    await this.end();
    return true;
  }

  /**
   * Getting current state of activity
   */
  public async getState(): Promise<ActivityStateEnum> {
    try {
      const { data } = await this.api.state.getActivityState(this.id);
      return data.state[0];
    } catch (error) {
      this.logger?.warn(`Cannot query activity state: ${error}`);
      throw error;
    }
  }

  protected async send(script: yaActivity.ExeScriptRequest): Promise<string> {
    const { data: batchId } = await this.api.control.exec(this.id, script, { timeout: this.requestTimeout });
    return batchId;
  }

  private async end() {
    await this.api.control
      .destroyActivity(this.id, this.requestTimeout, { timeout: (this.requestTimeout + 1) * 1000 })
      .catch((error) => {
        this.logger?.warn(`Got API Exception when destroying activity ${this.id}: ${error}`);
        throw error;
      });
    this.logger?.debug(`Activity ${this.id} ended.`);
  }

  private async pollingBatch(batchId, startTime, timeout, cancellationToken): Promise<Readable> {
    let isBatchFinished = false;
    let lastIndex;
    let retryCount = 0;
    const maxRetries = 3;
    const { id: activityId, executeTimeout, api, exeBatchResultsFetchInterval } = this;
    const handleError = this.handleError.bind(this);
    return new Readable({
      objectMode: true,
      async read() {
        while (!isBatchFinished) {
          if (startTime.valueOf() + (timeout || executeTimeout) <= new Date().valueOf()) {
            return this.destroy(new Error(`Activity ${activityId} timeout.`));
          }
          if (cancellationToken?.cancelled) {
            return this.destroy(new Error(`Activity ${activityId} has been interrupted.`));
          }
          try {
            const { data: results }: { data: Result[] } = await api.control.getExecBatchResults(activityId, batchId);
            const newResults = results.slice(lastIndex + 1);
            if (Array.isArray(newResults) && newResults.length) {
              newResults.forEach((result) => {
                this.push(result);
                isBatchFinished = result.isBatchFinished || false;
                lastIndex = result.index;
              });
            }
            await sleep(exeBatchResultsFetchInterval, true);
          } catch (error) {
            try {
              retryCount = await handleError(error, lastIndex, retryCount, maxRetries);
            } catch (error) {
              return this.destroy(error?.message || error);
            }
          }
        }
        this.push(null);
      },
    });
  }

  private async streamingBatch(batchId, batchSize, startTime, timeout, cancellationToken): Promise<Readable> {
    const basePath = this.options?.yagnaOptions?.basePath || this.api.control["configuration"]?.basePath;
    const apiKey = this.options?.yagnaOptions?.apiKey || this.api.control["configuration"]?.apiKey;
    const eventSource = new EventSource(`${basePath}/activity/${this.id}/exec/${batchId}`, {
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${apiKey}`,
      },
    });

    let isBatchFinished = false;
    const { id: activityId, executeTimeout } = this;

    const errors: object[] = [];
    eventSource.addEventListener("error", (error) => errors.push(error?.message || error));

    const results: Result[] = [];
    eventSource.addEventListener("runtime", (event) => results.push(this.parseEventToResult(event.data, batchSize)));

    return new Readable({
      objectMode: true,
      async read() {
        while (!isBatchFinished) {
          if (startTime.valueOf() + (timeout || executeTimeout) <= new Date().valueOf()) {
            return this.destroy(new Error(`Activity ${activityId} timeout.`));
          }
          if (cancellationToken?.cancelled) {
            return this.destroy(new Error(`Activity ${activityId} has been interrupted.`));
          }
          if (errors.length) {
            return this.destroy(new Error(`GetExecBatchResults failed due to errors: ${JSON.stringify(errors)}`));
          }
          if (results.length) {
            const result = results.shift();
            this.push(result);
            isBatchFinished = result?.isBatchFinished || false;
          }
          await sleep(500, true);
        }
        this.push(null);
      },
    });
  }

  private async handleError(error, cmdIndex, retryCount, maxRetries) {
    if (this.isTimeoutError(error)) {
      this.logger?.warn("API request timeout." + error.toString());
      return retryCount;
    }
    const { terminated, reason, errorMessage } = await this.isTerminated();
    if (terminated) {
      const msg = (reason || "") + (errorMessage || "");
      this.logger?.warn(`Activity ${this.id} terminated by provider. ${msg ? "Reason: " + msg : ""}`);
      throw error;
    }
    if (!this.isGsbError(error)) {
      throw error;
    }
    ++retryCount;
    const failMsg = "getExecBatchResults failed due to GSB error";
    if (retryCount < maxRetries) {
      this.logger?.debug(`${failMsg}, retrying in ${this.exeBatchResultsFetchInterval}.`);
      return retryCount;
    } else {
      this.logger?.debug(`${failMsg}, giving up after ${retryCount} attempts.`);
    }
    const msg = error?.response?.data?.message || error;
    throw new Error(`Command #${cmdIndex || 0} getExecBatchResults error: ${msg}`);
  }

  private isTimeoutError(error) {
    const timeoutMsg = error.message && error.message.includes("timeout");
    return (
      (error.response && error.response.status === 408) ||
      error.code === "ETIMEDOUT" ||
      (error.code === "ECONNABORTED" && timeoutMsg)
    );
  }

  private isGsbError(error) {
    // check if `err` is caused by "endpoint address not found" GSB error
    if (!error.response) {
      return false;
    }
    if (error.response.status !== 500) {
      return false;
    }
    if (!error.response.data || !error.response.data.message) {
      this.logger?.debug(`Cannot read error message, response: ${error.response}`);
      return false;
    }
    const message = error.response.data.message;
    return message.includes("endpoint address not found") && message.includes("GSB error");
  }

  private async isTerminated(): Promise<{ terminated: boolean; reason?: string; errorMessage?: string }> {
    try {
      const { data } = await this.api.state.getActivityState(this.id);
      return {
        terminated: data?.state?.[0] === ActivityStateEnum.Terminated,
        reason: data?.reason,
        errorMessage: data?.errorMessage,
      };
    } catch (err) {
      this.logger?.debug(`Cannot query activity state: ${err}`);
      return { terminated: false };
    }
  }

  private parseEventToResult(msg: string, batchSize: number): Result {
    try {
      const event: StreamingBatchEvent = JSON.parse(msg);
      return {
        index: event.index,
        eventDate: event.timestamp,
        result: event?.kind?.finished ? (event?.kind?.finished?.return_code === 0 ? "Ok" : "Error") : undefined,
        stdout: event?.kind?.stdout,
        stderr: event?.kind?.stderr,
        message: event?.kind?.finished?.message,
        isBatchFinished: event.index + 1 >= batchSize && Boolean(event?.kind?.finished),
      } as Result;
    } catch (error) {
      throw new Error(`Cannot parse ${msg} as StreamingBatchEvent`);
    }
  }
}
