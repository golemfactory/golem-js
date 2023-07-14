import { TaskOptions } from "./service.js";
import { ActivityConfig } from "../activity/config.js";
import { Logger } from "../utils/index.js";
import { StorageProvider } from "../storage/index.js";

const DEFAULTS = {
  maxParallelTasks: 5,
  taskRunningInterval: 1000,
  taskTimeout: 30000,
  activityStateCheckingInterval: 2000,
  activityPreparingTimeout: 1000 * 60 * 4, // 2 min
};

/**
 * @internal
 */
export class TaskConfig extends ActivityConfig {
  public readonly maxParallelTasks: number;
  public readonly taskRunningInterval: number;
  public readonly taskTimeout: number;
  public readonly activityStateCheckingInterval: number;
  public readonly activityPreparingTimeout: number;
  public readonly storageProvider?: StorageProvider;
  public readonly logger?: Logger;

  constructor(options?: TaskOptions) {
    super(options);
    this.maxParallelTasks = options?.maxParallelTasks || DEFAULTS.maxParallelTasks;
    this.taskRunningInterval = options?.taskRunningInterval || DEFAULTS.taskRunningInterval;
    this.taskTimeout = options?.taskTimeout || DEFAULTS.taskTimeout;
    this.activityStateCheckingInterval =
      options?.activityStateCheckingInterval || DEFAULTS.activityStateCheckingInterval;
    this.logger = options?.logger;
    this.storageProvider = options?.storageProvider;
    this.activityPreparingTimeout = options?.activityPreparingTimeout || DEFAULTS.activityPreparingTimeout;
  }
}
