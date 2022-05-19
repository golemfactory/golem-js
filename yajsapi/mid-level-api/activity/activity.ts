import { Command, Results, Script } from "./script";
import { Logger, LoggerOptions } from "../utils/logger";
import EventEmitter from "events";
import { ActivityStateStateEnum } from "ya-ts-client/dist/ya-activity/src/models/activity-state";
import { RequestorControlApi, RequestorStateApi } from "ya-ts-client/dist/ya-activity/api";
import { setInterval } from "timers";

export enum ActivityEvents {
  StateChanged = "StateChanged",
  ScriptSent = "ScriptSent",
  ScriptExecuted = "ScriptExecuted",
  ActivityEnded = "ActivityEnded",
}

export interface ActivityOptions {
  credentials?: { TODO: true };
  requestTimeout?: number;
  isResultsFetchingByStream?: boolean; // TODO: explain difference in docs / comments.
  stateFetchIntervalTime?: number; // TODO: explain event emitter via polling state..
  logger?: Logger | boolean;
  loggerOptions?: LoggerOptions;
}

export class Activity extends EventEmitter {
  private state: ActivityStateStateEnum;
  private readonly api: RequestorControlApi;
  private readonly stateApi: RequestorStateApi;
  private readonly logger?: Logger;
  private readonly stateFetchIntervalId?: NodeJS.Timeout;
  private readonly requestTimeout: number;
  private readonly isResultsFetchingByStream: boolean;
  private readonly stateFetchIntervalTime: number;

  constructor(public readonly id, private readonly options?: ActivityOptions) {
    super({ captureRejections: true });
    this.state = ActivityStateStateEnum.New;
    this.api = new RequestorControlApi();
    this.stateApi = new RequestorStateApi();
    this.requestTimeout = options?.requestTimeout || 10;
    this.isResultsFetchingByStream = options?.isResultsFetchingByStream || false;
    this.stateFetchIntervalTime = options?.stateFetchIntervalTime || 5000;
    if (options?.logger instanceof Logger) {
      this.logger = options.logger;
    } else if (options?.logger) {
      this.logger = new Logger(options?.loggerOptions);
    }
    this.stateFetchIntervalId = setInterval(() => this.getState(), this.stateFetchIntervalTime);
    this.getState();
  }

  async execute(script: Script): Promise<Results> {
    // TODO: if (this.state !== ActivityStateStateEnum.Ready) throw new Error("TODO");
    let batchId;
    try {
      const { data } = await this.api.exec(this.id, script.getExeScriptRequest(), { timeout: this.requestTimeout });
      batchId = data;
    } catch (error) {
      this.logger?.warn(`Error while sending batch script to provider: ${error}`);
      throw error;
    }
    this.emit(ActivityEvents.ScriptSent);
    if (this.isResultsFetchingByStream) {
      // todo
    }
    const api = this.api;
    const activityId = this.id;
    const emit = (e) => this.emit(e);
    let i = 0; // mocked
    return new Results({
      encoding: "utf8",
      async read() {
        if (i < 5) {
          // mocked
          const { data: results } = await api.getExecBatchResults(activityId, batchId);
          this.push(results.pop());
          ++i;
        } else {
          emit(ActivityEvents.ScriptExecuted);
          this.push(null);
        }
      },
    });
  }

  async stop(): Promise<boolean> {
    await this.end();
    return true;
  }

  async getState(): Promise<ActivityStateStateEnum> {
    const { data } = await this.stateApi.getActivityState(this.id);
    // TODO: catch and check error
    if (data?.state?.[0] && data?.state?.[0] !== this.state) {
      this.state = data.state[0];
      this.emit(ActivityEvents.StateChanged, this.state);
    }
    return this.state;
  }

  private async [EventEmitter.captureRejectionSymbol](error, event, ...args) {
    this.logger?.debug("Rejection happened for" + event + "with" + error + args);
    await this.end(error);
  }

  private async end(error?: Error) {
    // if (this.state !== ActivityStateStateEnum.Terminated)
    //   await this.api
    //     .destroyActivity(this.id, this.requestTimeout, { timeout: (this.requestTimeout + 1) * 1000 })
    //     .catch((error) => this.logger?.warn(`Got API Exception when destroying activity ${this.id}: ${error}`));
    if (this.stateFetchIntervalId) clearInterval(this.stateFetchIntervalId);
    await this.getState();
    this.emit(ActivityEvents.ActivityEnded, this.state);
    if (error) this.logger?.debug("Activity ended with an error: " + error);
    else this.logger?.debug("Activity ended");
  }
}

export { Script, Results, Command };
