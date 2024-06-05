import { ExecutionOptions } from "./exe-script-executor";

const DEFAULTS = {
  activityRequestTimeout: 10000,
  activityExecuteTimeout: 1000 * 60 * 5, // 5 min,
  activityExeBatchResultPollIntervalSeconds: 5,
  activityExeBatchResultMaxRetries: 20,
};

/**
 * @internal
 */
export class ExecutionConfig {
  public readonly activityRequestTimeout: number;
  public readonly activityExecuteTimeout: number;
  public readonly activityExeBatchResultPollIntervalSeconds: number;
  public readonly activityExeBatchResultMaxRetries: number;

  constructor(options?: ExecutionOptions) {
    this.activityRequestTimeout = options?.activityRequestTimeout || DEFAULTS.activityRequestTimeout;
    this.activityExecuteTimeout = options?.activityExecuteTimeout || DEFAULTS.activityExecuteTimeout;
    this.activityExeBatchResultMaxRetries =
      options?.activityExeBatchResultMaxRetries || DEFAULTS.activityExeBatchResultMaxRetries;
    this.activityExeBatchResultPollIntervalSeconds =
      options?.activityExeBatchResultPollIntervalSeconds || DEFAULTS.activityExeBatchResultPollIntervalSeconds;
  }
}
