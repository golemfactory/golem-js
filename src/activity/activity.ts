import { Agreement, ProviderInfo } from "../market/agreement";

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

export type ActivityUsageInfo = {
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
  /**
   * @param id The ID of the activity in Yagna
   * @param agreement The agreement that's related to this activity
   * @param currentState The current state as it was obtained from yagna
   * @param previousState The previous state (or New if this is the first time we're creating the activity)
   * @param usage Current resource usage vector information
   */
  constructor(
    public readonly id: string,
    public readonly agreement: Agreement,
    protected readonly currentState: ActivityStateEnum = ActivityStateEnum.New,
    protected readonly previousState: ActivityStateEnum = ActivityStateEnum.Unknown,
    protected readonly usage: ActivityUsageInfo,
  ) {}

  public get provider(): ProviderInfo {
    return this.agreement.provider;
  }

  public getState() {
    return this.currentState;
  }

  public getPreviousState() {
    return this.previousState;
  }
}
