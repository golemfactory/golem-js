import { ActivityOptions } from "./activity";
import { Logger, defaultLogger } from "../shared/utils";

const DEFAULTS = {
  activityRequestTimeout: 10000,
  activityExecuteTimeout: 1000 * 60 * 5, // 5 min,
  activityExeBatchResultPollIntervalSeconds: 5,
  activityExeBatchResultMaxRetries: 20,
};

/**
 * @internal
 */
export class ActivityConfig {
  public readonly activityRequestTimeout: number;
  public readonly activityExecuteTimeout: number;
  public readonly activityExeBatchResultPollIntervalSeconds: number;
  public readonly activityExeBatchResultMaxRetries: number;
  public readonly logger: Logger;

  constructor(options?: ActivityOptions) {
    this.activityRequestTimeout = options?.activityRequestTimeout || DEFAULTS.activityRequestTimeout;
    this.activityExecuteTimeout = options?.activityExecuteTimeout || DEFAULTS.activityExecuteTimeout;
    this.activityExeBatchResultMaxRetries =
      options?.activityExeBatchResultMaxRetries || DEFAULTS.activityExeBatchResultMaxRetries;
    this.activityExeBatchResultPollIntervalSeconds =
      options?.activityExeBatchResultPollIntervalSeconds || DEFAULTS.activityExeBatchResultPollIntervalSeconds;
    this.logger = options?.logger || defaultLogger("work");
  }
}
