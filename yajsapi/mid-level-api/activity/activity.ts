import { Results, BatchResults, StreamResults } from "./results";
import { ActivityStateStateEnum } from "ya-ts-client/dist/ya-activity/src/models/activity-state";
import { RequestorControlApi, RequestorStateApi } from "ya-ts-client/dist/ya-activity/api";
import { yaActivity } from "ya-ts-client";
import { Logger, sleep, CancellationToken } from "../utils";
import { logger } from "../../utils";

export interface ActivityOptions {
  credentials?: { apiKey?: string; basePath?: string };
  requestTimeout?: number;
  responseTimeout?: number;
  executeTimeout?: number;
  exeBatchResultsFetchInterval?: number;
  logger?: Logger;
}

export class Activity {
  private state: ActivityStateStateEnum;
  private readonly api: RequestorControlApi;
  private readonly stateApi: RequestorStateApi;
  private readonly logger?: Logger;
  private readonly stateFetchIntervalId?: NodeJS.Timeout;
  private readonly requestTimeout: number;
  private readonly responseTimeout: number;
  private readonly executeTimeout: number;
  private readonly exeBatchResultsFetchInterval: number;

  constructor(public readonly id, private readonly options?: ActivityOptions) {
    this.state = ActivityStateStateEnum.New;
    const config = new yaActivity.Configuration({
      apiKey: this.options?.credentials?.apiKey || process.env.YAGNA_APPKEY,
      basePath: this.options?.credentials?.basePath || process.env.YAGNA_API_BASEPATH,
      accessToken: this.options?.credentials?.apiKey || process.env.YAGNA_APPKEY,
    });
    this.api = new RequestorControlApi(config);
    this.stateApi = new RequestorStateApi(config);
    this.requestTimeout = options?.requestTimeout || 10000;
    this.responseTimeout = options?.responseTimeout || 10000;
    this.executeTimeout = options?.executeTimeout || 20000;
    this.exeBatchResultsFetchInterval = options?.exeBatchResultsFetchInterval || 3000;
    if (options?.logger instanceof Logger) {
      this.logger = options.logger;
    } else if (options?.logger !== false) {
      this.logger = new Logger();
    }
  }

  async execute(
    script: yaActivity.ExeScriptRequest,
    stream?: boolean,
    timeout?: number,
    cancellationToken?: CancellationToken
  ): Promise<Results> {
    let batchId;
    let startTime = new Date();
    try {
      const { data } = await this.api.exec(this.id, script, { timeout: this.requestTimeout });
      batchId = data;
      startTime = new Date();
    } catch (error) {
      console.error(error);
      throw new Error(error?.response?.data?.message || error);
    }
    if (stream) {
      // todo
      return new Results<StreamResults>();
    }
    let isBatchFinished = false;
    let lastIndex;
    const retryCount = 0;
    const maxRetries = 3;
    const { id: activityId, executeTimeout, api, handleError, exeBatchResultsFetchInterval } = this;
    return new Results<BatchResults>({
      objectMode: true,
      async read() {
        while (!isBatchFinished) {
          if (startTime.valueOf() + (timeout || executeTimeout) <= new Date().valueOf()) {
            throw new Error(`Activity ${activityId} timeout.`);
          }
          if (cancellationToken?.cancelled) {
            throw new Error(`Activity ${activityId} has been interrupted.`);
          }
          try {
            const { data: results } = await api.getExecBatchResults(activityId, batchId);
            const newResults = results.slice(lastIndex + 1);
            if (newResults.length) {
              newResults.forEach((result) => {
                this.push(result);
                isBatchFinished = result.isBatchFinished || false;
                lastIndex = result.index;
              });
            }
            await sleep(exeBatchResultsFetchInterval);
          } catch (error) {
            await handleError(error, lastIndex, retryCount, maxRetries);
          }
        }
        this.push(null);
      },
    });
  }

  async stop(): Promise<boolean> {
    await this.end();
    return true;
  }

  async getState(): Promise<ActivityStateStateEnum> {
    try {
      const { data } = await this.stateApi.getActivityState(this.id);
      if (data?.state?.[0] && data?.state?.[0] !== this.state) {
        this.state = data.state[0];
      }
      return this.state;
    } catch (error) {
      logger.warn(`Error while getting activity state: ${error}`);
      throw error;
    }
  }

  private async end(error?: Error) {
    await this.api
      .destroyActivity(this.id, this.requestTimeout, { timeout: (this.requestTimeout + 1) * 1000 })
      .catch((error) => this.logger?.warn(`Got API Exception when destroying activity ${this.id}: ${error}`));
    if (this.stateFetchIntervalId) clearInterval(this.stateFetchIntervalId);
    await this.getState();
    if (error) this.logger?.debug("Activity ended with an error: " + error);
    else this.logger?.debug("Activity ended");
  }

  private async handleError(error, cmdIndex, retryCount, maxRetries) {
    if (!this.isGsbError(error)) {
      throw error;
    }
    if (this.isTimeoutError(error)) {
      this.logger?.warn("API request timeout." + error.toString());
      return;
    }
    const { terminated, reason, errorMessage } = await this.isTerminated();
    if (terminated) {
      this.logger?.warn(`Activity ${this.id} terminated by provider. Reason: ${reason}, Error: ${errorMessage}`);
      throw error;
    }
    ++retryCount;
    const fail_msg = "getExecBatchResults failed due to GSB error";
    if (retryCount < maxRetries) {
      this.logger?.debug(`${fail_msg}, retrying in ${this.exeBatchResultsFetchInterval}.`);
      return;
    } else {
      this.logger?.debug(`${fail_msg}, giving up after ${retryCount} attempts.`);
    }
    const msg = error?.response?.data?.message || error;
    throw new Error(`Command #${cmdIndex} getExecBatchResults error: ${msg}`);
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
        terminated: data?.state?.[0] === ActivityStateStateEnum.Terminated,
        reason: data?.reason,
        errorMessage: data?.errorMessage,
      };
    } catch (err) {
      this.logger?.debug(`Cannot query activity state: ${err}`);
      return { terminated: false };
    }
  }
}
