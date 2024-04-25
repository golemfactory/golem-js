import { Logger } from "../shared/utils";
import { ExecutionOptions } from "./config";
import { Agreement, ProviderInfo } from "../agreement";
import { EventEmitter } from "eventemitter3";
import { ActivityApi } from "ya-ts-client";
import { YagnaExeScriptObserver } from "../shared/yagna";
import { ExeScriptExecutor } from "./exe-script-executor";

/** @deprecated */
export interface ActivityEvents {
  scriptSent: (details: { activityId: string; agreementId: string }) => void;
  scriptExecuted: (details: { activityId: string; agreementId: string; success: boolean }) => void;
  destroyed: (details: { id: string; agreementId: string }) => void;
}

export enum ActivityStateEnum {
  New = "New",
  Initialized = "Initialized",
  Deployed = "Deployed",
  Ready = "Ready",
  Unresponsive = "Unresponsive",
  Terminated = "Terminated",
  /** In case when we couldn't establish the in on yagna */
  Unknown = "Unknown",
}

export interface ActivityOptions {
  /** timeout for sending and creating batch */
  activityRequestTimeout?: number;
  /** timeout for executing batch */
  activityExecuteTimeout?: number;
  /** interval for fetching batch results while polling */
  activityExeBatchResultPollIntervalSeconds?: number;
  /** maximum number of retries retrieving results when an error occurs, default: 10 */
  activityExeBatchResultMaxRetries?: number;
  /** Logger module */
  logger?: Logger;
}

type ActivityUsageInfo = {
  currentUsage?: number[];
  timestamp: number;
};

export interface IActivityRepository {
  getById(id: string): Promise<Activity>;

  getStateOfActivity(id: string): Promise<ActivityStateEnum>;
}

/**
 * Activity module - an object representing the runtime environment on the provider in accordance with the `Package` specification.
 * As part of a given activity, it is possible to execute exe script commands and capture their results.
 */
export class Activity {
  public readonly events = new EventEmitter<ActivityEvents>();

  /**
   * @param id The ID of the activity in Yagna
   * @param agreement The agreement that's related to this activity
   * @param currentState The current state as it was obtained from yagna
   * @param usage Current resource usage vector information
   */
  constructor(
    public readonly id: string,
    public readonly agreement: Agreement,
    protected readonly currentState: ActivityStateEnum = ActivityStateEnum.New,
    protected readonly usage: ActivityUsageInfo,
  ) {}

  public getProviderInfo(): ProviderInfo {
    return this.agreement.getProviderInfo();
  }

  /**
   * Temporary helper method that will build a script executor bound to this activity
   */
  public createExeScriptExecutor(
    activityControl: ActivityApi.RequestorControlService,
    execObserver: YagnaExeScriptObserver,
    logger: Logger,
    options?: ExecutionOptions,
  ) {
    return new ExeScriptExecutor(this, logger, activityControl, execObserver, options);
  }

  public getState() {
    return this.currentState;
  }
}
