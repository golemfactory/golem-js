import { TaskServiceOptions } from "./service";
import { ActivityConfig } from "../activity";
import { Logger } from "../utils";
import { StorageProvider } from "../storage";

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

  constructor(options?: TaskServiceOptions) {
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
