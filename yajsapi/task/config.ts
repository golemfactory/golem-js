import { TaskOptions } from "./service";
import { ActivityConfig } from "../activity/config";
import { Logger } from "../utils";
import { StorageProvider } from "../storage/provider";

const DEFAULTS = {
  maxParallelTasks: 5,
  taskRunningInterval: 1000,
  timeout: 30000,
  activityStateCheckingInterval: 1000,
};

export class TaskConfig extends ActivityConfig {
  public readonly maxParallelTasks: number;
  public readonly taskRunningInterval: number;
  public readonly timeout: number;
  public readonly activityStateCheckingInterval: number;
  public readonly storageProvider?: StorageProvider;
  public readonly logger?: Logger;

  constructor(options?: TaskOptions) {
    super(options);
    this.maxParallelTasks = options?.maxParallelTasks || DEFAULTS.maxParallelTasks;
    this.taskRunningInterval = options?.taskRunningInterval || DEFAULTS.taskRunningInterval;
    this.timeout = options?.timeout || DEFAULTS.timeout;
    this.activityStateCheckingInterval =
      options?.activityStateCheckingInterval || DEFAULTS.activityStateCheckingInterval;
    this.logger = options?.logger;
    this.storageProvider = options?.storageProvider;
  }
}
