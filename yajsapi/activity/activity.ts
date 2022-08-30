import { Result, StreamingBatchEvent } from "./results";
import {
  ActivityStateStateEnum as ActivityStateEnum,
  ExeScriptRequest,
} from "ya-ts-client/dist/ya-activity/src/models";
import { RequestorControlApi, RequestorStateApi } from "ya-ts-client/dist/ya-activity/api";
import { yaActivity } from "ya-ts-client";
import EventSource from "eventsource";
import { Readable } from "stream";
import { Logger } from "../utils/logger";
import sleep from "../utils/sleep";
import CancellationToken from "../utils/cancellationToken";

export interface ActivityOptions {
  credentials?: { apiKey?: string; basePath?: string };
  requestTimeout?: number;
  responseTimeout?: number;
  executeTimeout?: number;
  exeBatchResultsFetchInterval?: number;
  logger?: Logger;
  taskPackage?: string;
}

export { ActivityStateEnum };

export class Activity {
  private readonly config: { apiKey: string; basePath: string };
  protected readonly api: RequestorControlApi;
  private readonly stateApi: RequestorStateApi;
  private readonly logger?: Logger;
  protected readonly requestTimeout: number;
  private readonly responseTimeout: number;
  private readonly executeTimeout: number;
  private readonly exeBatchResultsFetchInterval: number;

  constructor(public readonly id, protected readonly options?: ActivityOptions) {
    const apiKey = this.options?.credentials?.apiKey || process.env.YAGNA_APPKEY;
    const basePath = this.options?.credentials?.basePath || process.env.YAGNA_API_BASEPATH;
    if (!apiKey) throw new Error("Api key not defined");
    if (!basePath) throw new Error("Api base path not defined");
    this.config = { apiKey, basePath };
    const apiConfig = new yaActivity.Configuration({ apiKey, basePath, accessToken: apiKey });
    this.api = new RequestorControlApi(apiConfig);
    this.stateApi = new RequestorStateApi(apiConfig);
    this.requestTimeout = options?.requestTimeout || 10000;
    this.responseTimeout = options?.responseTimeout || 10000;
    this.executeTimeout = options?.executeTimeout || 60000;
    this.exeBatchResultsFetchInterval = options?.exeBatchResultsFetchInterval || 3000;
    this.logger = options?.logger;
  }

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

  public async stop(): Promise<boolean> {
    await this.end();
    return true;
  }

  public async getState(): Promise<ActivityStateEnum> {
    try {
      const { data } = await this.stateApi.getActivityState(this.id);
      return data.state[0];
    } catch (error) {
      this.logger?.warn(`Cannot query activity state: ${error}`);
      throw error;
    }
  }

  protected async send(script: yaActivity.ExeScriptRequest): Promise<string> {
    const { data: batchId } = await this.api.exec(this.id, script, { timeout: this.requestTimeout });
    return batchId;
  }

  private async end() {
    await this.api
      .destroyActivity(this.id, this.requestTimeout, { timeout: (this.requestTimeout + 1) * 1000 })
      .catch((error) => {
        this.logger?.warn(`Got API Exception when destroying activity ${this.id}: ${error}`);
        throw error;
      });
    this.logger?.debug("Activity ended");
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
            this.destroy(new Error(`Activity ${activityId} timeout.`));
          }
          if (cancellationToken?.cancelled) {
            this.destroy(new Error(`Activity ${activityId} has been interrupted.`));
          }
          try {
            const { data: results }: { data: Result[] } = await api.getExecBatchResults(activityId, batchId);
            const newResults = results.slice(lastIndex + 1);
            if (Array.isArray(newResults) && newResults.length) {
              newResults.forEach((result) => {
                // if (result.result === "Error") {
                //   this.destroy(
                //     new Error(
                //       `Error: ${result?.message}. Stdout: ${result?.stdout?.trim()}. Stderr: ${result?.stderr?.trim()}`
                //     )
                //   );
                // }
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
              return this.destroy(error);
            }
          }
        }
        this.push(null);
      },
    });
  }

  private async streamingBatch(batchId, batchSize, startTime, timeout, cancellationToken): Promise<Readable> {
    const eventSource = new EventSource(`${this.config.basePath}/activity/${this.id}/exec/${batchId}`, {
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${this.config.apiKey}`,
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
            this.destroy(new Error(`Activity ${activityId} timeout.`));
          }
          if (cancellationToken?.cancelled) {
            this.destroy(new Error(`Activity ${activityId} has been interrupted.`));
          }
          if (errors.length) {
            this.destroy(new Error(`GetExecBatchResults failed due to errors: ${JSON.stringify(errors)}`));
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
      this.logger?.warn(`Activity ${this.id} terminated by provider. Reason: ${reason}, Error: ${errorMessage}`);
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
      const { data } = await this.stateApi.getActivityState(this.id);
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
