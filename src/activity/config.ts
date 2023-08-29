import { ActivityOptions } from "./activity";
import { Logger } from "../utils";

const DEFAULTS = {
  activityRequestTimeout: 10000,
  activityExecuteTimeout: 1000 * 60 * 5, // 5 min,
  activityExeBatchResultsFetchInterval: 20000,
};

/**
 * @internal
 */
export class ActivityConfig {
  public readonly activityRequestTimeout: number;
  public readonly activityExecuteTimeout: number;
  public readonly activityExeBatchResultsFetchInterval: number;
  public readonly logger?: Logger;
  public readonly eventTarget?: EventTarget;

  constructor(options?: ActivityOptions) {
    this.activityRequestTimeout = options?.activityRequestTimeout || DEFAULTS.activityRequestTimeout;
    this.activityExecuteTimeout = options?.activityExecuteTimeout || DEFAULTS.activityExecuteTimeout;
    this.activityExeBatchResultsFetchInterval =
      options?.activityExeBatchResultsFetchInterval || DEFAULTS.activityExeBatchResultsFetchInterval;
    this.logger = options?.logger;
    this.eventTarget = options?.eventTarget;
  }
}
