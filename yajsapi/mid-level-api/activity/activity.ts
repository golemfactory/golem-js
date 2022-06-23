import { Results, BatchResults, StreamResults } from "./results";
import { ActivityStateStateEnum as ActivityStateEnum } from "ya-ts-client/dist/ya-activity/src/models/activity-state";
import { RequestorControlApi, RequestorStateApi } from "ya-ts-client/dist/ya-activity/api";
import { yaActivity } from "ya-ts-client";
import { Logger, sleep, CancellationToken } from "../utils";
import EventSource from "eventsource";

export interface ActivityOptions {
  credentials?: { apiKey?: string; basePath?: string };
  requestTimeout?: number;
  responseTimeout?: number;
  executeTimeout?: number;
  exeBatchResultsFetchInterval?: number;
  logger?: Logger;
}

export { ActivityStateEnum };

export class Activity {
  private readonly config: { apiKey: string; basePath: string };
  private readonly api: RequestorControlApi;
  private readonly stateApi: RequestorStateApi;
  private readonly logger?: Logger;
  private readonly requestTimeout: number;
  private readonly responseTimeout: number;
  private readonly executeTimeout: number;
  private readonly exeBatchResultsFetchInterval: number;

  constructor(public readonly id, private readonly options?: ActivityOptions) {
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
      this.logger?.error(error);
      throw new Error(error?.response?.data?.message || error);
    }
    return stream ? this.streamingBatch() : this.pollingBatch(batchId, startTime, timeout, cancellationToken);
  }

  async stop(): Promise<boolean> {
    await this.end();
    return true;
  }

  async getState(): Promise<ActivityStateEnum> {
    try {
      const { data } = await this.stateApi.getActivityState(this.id);
      return data.state[0];
    } catch (error) {
      this.logger?.warn(`Cannot query activity state: ${error}`);
      throw error;
    }
  }

  private async end(error?: Error) {
    await this.api
      .destroyActivity(this.id, this.requestTimeout, { timeout: (this.requestTimeout + 1) * 1000 })
      .catch((error) => this.logger?.warn(`Got API Exception when destroying activity ${this.id}: ${error}`));
    if (error) this.logger?.debug("Activity ended with an error: " + error);
    else this.logger?.debug("Activity ended");
  }

  private async pollingBatch(batchId, startTime, timeout, cancellationToken): Promise<Results<BatchResults>> {
    let isBatchFinished = false;
    let lastIndex;
    let retryCount = 0;
    const maxRetries = 3;
    const { id: activityId, executeTimeout, api, exeBatchResultsFetchInterval } = this;
    const handleError = this.handleError.bind(this);
    return new Results<BatchResults>({
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
            retryCount = await handleError(error, lastIndex, retryCount, maxRetries).catch((error) =>
              this.destroy(error)
            );
          }
        }
        this.push(null);
      },
    });
  }

  private async streamingBatch(batchId): Promise<Results<StreamResults>> {
    const eventSource = new EventSource(`${this.config.basePath}/activity/${this.id}/exec/${batchId}`, {
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
    });
    eventSource.addEventListener("error", (e) => console.error(e));
    eventSource.addEventListener("runtime", (e) => console.log(e));
    while (true) sleep(3000);
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
}
