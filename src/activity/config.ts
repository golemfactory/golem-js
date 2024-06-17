import { ExecutionOptions } from "./exe-script-executor";

const DEFAULTS = {
  activityExeBatchResultPollIntervalSeconds: 5,
  activityExeBatchResultMaxRetries: 20,
};

/**
 * @internal
 */
export class ExecutionConfig {
  public readonly activityExeBatchResultPollIntervalSeconds: number;
  public readonly activityExeBatchResultMaxRetries: number;

  constructor(options?: ExecutionOptions) {
    this.activityExeBatchResultMaxRetries =
      options?.activityExeBatchResultMaxRetries || DEFAULTS.activityExeBatchResultMaxRetries;
    this.activityExeBatchResultPollIntervalSeconds =
      options?.activityExeBatchResultPollIntervalSeconds || DEFAULTS.activityExeBatchResultPollIntervalSeconds;
  }
}
