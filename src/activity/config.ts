import { ActivityOptions } from "./activity";
import { Logger } from "../utils";

const DEFAULTS = {
  activityRequestTimeout: 10000,
  activityExecuteTimeout: 1000 * 60 * 5, // 5 min,
  activityExeBatchResultPollIntervalSeconds: 5,
};

/**
 * @internal
 */
export class ActivityConfig {
  public readonly activityRequestTimeout: number;
  public readonly activityExecuteTimeout: number;
  public readonly activityExeBatchResultPollIntervalSeconds: number;
  public readonly logger?: Logger;
  public readonly eventTarget?: EventTarget;

  constructor(options?: ActivityOptions) {
    this.activityRequestTimeout = options?.activityRequestTimeout || DEFAULTS.activityRequestTimeout;
    this.activityExecuteTimeout = options?.activityExecuteTimeout || DEFAULTS.activityExecuteTimeout;
    this.activityExeBatchResultPollIntervalSeconds =
      options?.activityExeBatchResultPollIntervalSeconds || DEFAULTS.activityExeBatchResultPollIntervalSeconds;
    this.logger = options?.logger;
    this.eventTarget = options?.eventTarget;
  }
}
