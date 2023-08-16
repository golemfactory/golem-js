import { Result, StreamingBatchEvent } from "./results";
import EventSource from "eventsource";
import { Readable } from "stream";
import { Logger } from "../utils";
import sleep from "../utils/sleep";
import { ActivityFactory } from "./factory";
import { ActivityConfig } from "./config";
import { Events } from "../events";
import { YagnaApi } from "../utils/yagna/yagna";

/**
 * @hidden
 */
export enum ActivityStateEnum {
  New = "New",
  Initialized = "Initialized",
  Deployed = "Deployed",
  Ready = "Ready",
  Unresponsive = "Unresponsive",
  Terminated = "Terminated",
}

/**
 * @hidden
 */
export interface ExeScriptRequest {
  text: string;
}

export interface ActivityOptions {
  /** timeout for sending and creating batch */
  activityRequestTimeout?: number;
  /** timeout for executing batch */
  activityExecuteTimeout?: number;
  /** interval for fetching batch results while polling */
  activityExeBatchResultsFetchInterval?: number;
  /** Logger module */
  logger?: Logger;
  /** Event Bus implements EventTarget  */
  eventTarget?: EventTarget;
}

/**
 * Activity module - an object representing the runtime environment on the provider in accordance with the `Package` specification.
 * As part of a given activity, it is possible to execute exe script commands and capture their results.
 * @hidden
 */
export class Activity {
  private readonly logger?: Logger;
  private isRunning = true;
  private currentState: ActivityStateEnum = ActivityStateEnum.New;

  /**
   * @param id activity ID
   * @param agreementId agreement ID
   * @param options - {@link ActivityOptions}
   * @hidden
   */
  constructor(
    public readonly id,
    public readonly agreementId,
    protected readonly yagnaApi: YagnaApi,
    protected readonly options: ActivityConfig,
  ) {
    this.logger = options?.logger;
  }

  /**
   * Create activity for given agreement ID
   *
   * @param agreementId
   * @param yagnaApi
   * @param options - {@link ActivityOptions}
   * @param secure - defines if activity will be secure type
   * @return Activity
   */
  static async create(
    agreementId: string,
    yagnaApi: YagnaApi,
    options?: ActivityOptions,
    secure = false,
  ): Promise<Activity> {
    const factory = new ActivityFactory(agreementId, yagnaApi, options);
    return factory.create(secure);
  }

  /**
   * Execute script
   *
   * @param script - exe script request
   * @param stream - define type of getting results from execution (polling or streaming)
   * @param timeout - execution timeout
   */
  public async execute(script: ExeScriptRequest, stream?: boolean, timeout?: number): Promise<Readable> {
    let batchId, batchSize;
    let startTime = new Date();
    try {
      batchId = await this.send(script);
      startTime = new Date();
      batchSize = JSON.parse(script.text).length;
    } catch (error) {
      this.logger?.error(error?.response?.data?.message || error.message || error);
      throw new Error(error);
    }
    this.logger?.debug(`Script sent. Batch ID: ${batchId}`);
    this.options.eventTarget?.dispatchEvent(
      new Events.ScriptSent({ activityId: this.id, agreementId: this.agreementId }),
    );
    return stream
      ? this.streamingBatch(batchId, batchSize, startTime, timeout)
      : this.pollingBatch(batchId, startTime, timeout);
  }

  /**
   * Stop and destroy activity
   *
   * @return boolean
   */
  public async stop(): Promise<boolean> {
    this.isRunning = false;
    await this.end();
    return true;
  }

  /**
   * Getting current state of activity
   *
   * @return state
   * @throws Error when cannot query the state
   */
  public async getState(): Promise<ActivityStateEnum> {
    try {
      const { data } = await this.yagnaApi.activity.state.getActivityState(this.id);
      const state = data.state[0];
      if (this.currentState !== ActivityStateEnum[state]) {
        this.options.eventTarget?.dispatchEvent(
          new Events.ActivityStateChanged({ id: this.id, state: ActivityStateEnum[state] }),
        );
        this.currentState = ActivityStateEnum[state];
      }
      return ActivityStateEnum[state];
    } catch (error) {
      this.logger?.warn(`Cannot query activity state: ${error?.response?.data?.message || error?.message || error}`);
      throw error;
    }
  }

  protected async send(script: ExeScriptRequest): Promise<string> {
    const { data: batchId } = await this.yagnaApi.activity.control.exec(this.id, script, {
      timeout: this.options.activityRequestTimeout,
    });
    return batchId;
  }

  private async end() {
    await this.yagnaApi.activity.control
      .destroyActivity(this.id, this.options.activityRequestTimeout / 1000, {
        timeout: this.options.activityRequestTimeout + 1000,
      })
      .catch((error) => {
        throw new Error(
          `Unable to destroy activity ${this.id}. ${error?.response?.data?.message || error?.message || error}`,
        );
      });
    this.options.eventTarget?.dispatchEvent(new Events.ActivityDestroyed(this));
    this.logger?.debug(`Activity ${this.id} destroyed`);
  }

  private async pollingBatch(batchId, startTime, timeout): Promise<Readable> {
    let isBatchFinished = false;
    let lastIndex;
    let retryCount = 0;
    const maxRetries = 5;
    const { id: activityId, agreementId } = this;
    const isRunning = () => this.isRunning;
    const { activityExecuteTimeout, activityExeBatchResultsFetchInterval, eventTarget } = this.options;
    const api = this.yagnaApi.activity;
    const handleError = this.handleError.bind(this);
    return new Readable({
      objectMode: true,
      async read() {
        while (!isBatchFinished) {
          if (startTime.valueOf() + (timeout || activityExecuteTimeout) <= new Date().valueOf()) {
            return this.destroy(new Error(`Activity ${activityId} timeout.`));
          }
          if (!isRunning()) {
            return this.destroy(new Error(`Activity ${activityId} has been interrupted.`));
          }
          try {
            // This will ignore "incompatibility" between ExeScriptCommandResultResultEnum and ResultState, which both
            // contain exactly the same entries, however TSC refuses to compile it as it assumes the former is dynamicaly
            // computed.
            const { data: results }: { data: Result[] } = (await api.control.getExecBatchResults(
              activityId,
              batchId,
            )) as unknown as { data: Result[] };
            retryCount = 0;
            const newResults = results.slice(lastIndex + 1);
            if (Array.isArray(newResults) && newResults.length) {
              newResults.forEach((result) => {
                this.push(result);
                isBatchFinished = result.isBatchFinished || false;
                lastIndex = result.index;
              });
            }
            if (!isBatchFinished) await sleep(activityExeBatchResultsFetchInterval, true);
          } catch (error) {
            try {
              retryCount = await handleError(error, lastIndex, retryCount, maxRetries);
            } catch (error) {
              eventTarget?.dispatchEvent(new Events.ScriptExecuted({ activityId, agreementId, success: false }));
              return this.destroy(new Error(`Unable to get activity results. ${error?.message || error}`));
            }
          }
        }
        eventTarget?.dispatchEvent(new Events.ScriptExecuted({ activityId, agreementId, success: true }));
        this.push(null);
      },
    });
  }

  private async streamingBatch(batchId, batchSize, startTime, timeout): Promise<Readable> {
    const basePath = this.yagnaApi.activity.control["configuration"]?.basePath;
    const apiKey = this.yagnaApi.activity.control["configuration"]?.apiKey;
    const eventSource = new EventSource(`${basePath}/activity/${this.id}/exec/${batchId}`, {
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${apiKey}`,
      },
    });

    let isBatchFinished = false;
    const activityId = this.id;
    const isRunning = () => this.isRunning;
    const activityExecuteTimeout = this.options.activityExecuteTimeout;

    const errors: object[] = [];
    eventSource.addEventListener("error", (error) => errors.push(error.data.message ?? error));

    const results: Result[] = [];
    eventSource.addEventListener("runtime", (event) => results.push(this.parseEventToResult(event.data, batchSize)));

    return new Readable({
      objectMode: true,
      async read() {
        while (!isBatchFinished) {
          if (startTime.valueOf() + (timeout || activityExecuteTimeout) <= new Date().valueOf()) {
            return this.destroy(new Error(`Activity ${activityId} timeout.`));
          }
          if (!isRunning()) {
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
    ++retryCount;
    const failMsg = "There was an error retrieving activity results. ";
    const errorMsg = error?.response?.data?.message || error?.message || error;
    if (retryCount < maxRetries) {
      this.logger?.debug(`${failMsg} Retrying in ${this.options.activityExeBatchResultsFetchInterval}.`);
      return retryCount;
    } else {
      this.logger?.error(`${failMsg} Giving up after ${retryCount} attempts. ${errorMsg}`);
    }
    throw new Error(`Command #${cmdIndex || 0} getExecBatchResults error: ${errorMsg}`);
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
      const { data } = await this.yagnaApi.activity.state.getActivityState(this.id);
      const state = ActivityStateEnum[data?.state?.[0]];
      return {
        terminated: state === ActivityStateEnum.Terminated,
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
