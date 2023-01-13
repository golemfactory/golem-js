import { Result, StreamingBatchEvent } from "./results";
import EventSource from "eventsource";
import { Readable } from "stream";
import { Logger } from "../utils";
import sleep from "../utils/sleep";
import { ActivityFactory } from "./factory";
import { ActivityConfig } from "./config";
import { Events } from "../events";

export enum ActivityStateEnum {
  New = "New",
  Initialized = "Initialized",
  Deployed = "Deployed",
  Ready = "Ready",
  Unresponsive = "Unresponsive",
  Terminated = "Terminated",
}

export interface ExeScriptRequest {
  text: string;
}

export interface ActivityOptions {
  yagnaOptions?: {
    /** Yagna Api Key */
    apiKey?: string;
    /** Yagna base path to Activity REST Api */
    basePath?: string;
  };
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
  /** taskPackage */
  taskPackage?: string;
}

export class Activity {
  private readonly logger?: Logger;
  private isRunning = true;

  /**
   * Create activity instance
   *
   * @param id activity ID
   * @param agreementId agreement ID
   * @param options - {@link ActivityOptions}
   * @ignore
   */
  constructor(public readonly id, public readonly agreementId, protected readonly options: ActivityConfig) {
    this.logger = options?.logger;
  }

  /**
   * Create activity for given agreement ID
   *
   * @param agreementId
   * @param options - {@link ActivityOptions}
   * @param secure - defines if activity will be secure type
   * @return Activity
   */
  static async create(agreementId: string, options?: ActivityOptions, secure = false): Promise<Activity> {
    const factory = new ActivityFactory(agreementId, options);
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
      this.logger?.error(error);
      throw new Error(error?.response?.data?.message || error);
    }
    this.logger?.debug(`Script sent. Batch ID: ${batchId}`);
    this.options.eventTarget?.dispatchEvent(
      new Events.ScriptSent({ activityId: this.id, agreementId: this.agreementId })
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
      const { data } = await this.options.api.state.getActivityState(this.id);
      const state = data.state[0];
      return ActivityStateEnum[state];
    } catch (error) {
      this.logger?.warn(`Cannot query activity state: ${error}`);
      throw error;
    }
  }

  protected async send(script: ExeScriptRequest): Promise<string> {
    const { data: batchId } = await this.options.api.control.exec(this.id, script, {
      timeout: this.options.activityRequestTimeout,
    });
    return batchId;
  }

  private async end() {
    await this.options.api.control
      .destroyActivity(this.id, this.options.activityRequestTimeout, {
        timeout: (this.options.activityRequestTimeout + 1) * 1000,
      })
      .catch((error) => {
        this.logger?.warn(`Got API Exception when destroying activity ${this.id}: ${error}`);
        throw error;
      });
    this.options.eventTarget?.dispatchEvent(new Events.ActivityDestroyed(this));
    this.logger?.debug(`Activity ${this.id} destroyed`);
  }

  private async pollingBatch(batchId, startTime, timeout): Promise<Readable> {
    let isBatchFinished = false;
    let lastIndex;
    let retryCount = 0;
    const maxRetries = 3;
    const { id: activityId, agreementId } = this;
    const isRunning = () => this.isRunning;
    const { activityExecuteTimeout, api, activityExeBatchResultsFetchInterval, eventTarget } = this.options;
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
            const { data: results }: { data: Result[] } = await api.control.getExecBatchResults(activityId, batchId);
            const newResults = results.slice(lastIndex + 1);
            if (Array.isArray(newResults) && newResults.length) {
              newResults.forEach((result) => {
                this.push(result);
                isBatchFinished = result.isBatchFinished || false;
                lastIndex = result.index;
              });
            }
            await sleep(activityExeBatchResultsFetchInterval, true);
          } catch (error) {
            try {
              retryCount = await handleError(error, lastIndex, retryCount, maxRetries);
            } catch (error) {
              eventTarget?.dispatchEvent(new Events.ScriptExecuted({ activityId, agreementId, success: false }));
              return this.destroy(error?.message || error);
            }
          }
        }
        eventTarget?.dispatchEvent(new Events.ScriptExecuted({ activityId, agreementId, success: true }));
        this.push(null);
      },
    });
  }

  private async streamingBatch(batchId, batchSize, startTime, timeout): Promise<Readable> {
    const basePath = this.options?.yagnaOptions?.basePath || this.options.api.control["configuration"]?.basePath;
    const apiKey = this.options?.yagnaOptions?.apiKey || this.options.api.control["configuration"]?.apiKey;
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
    eventSource.addEventListener("error", (error) => errors.push(error?.message || error));

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
    if (!this.isGsbError(error)) {
      throw error;
    }
    ++retryCount;
    const failMsg = "getExecBatchResults failed due to GSB error";
    if (retryCount < maxRetries) {
      this.logger?.debug(`${failMsg}, retrying in ${this.options.activityExeBatchResultsFetchInterval}.`);
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
      const { data } = await this.options.api.state.getActivityState(this.id);
      const state = ActivityStateEnum[data?.state?.[0]]; // TODO pls check @mgordel
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
