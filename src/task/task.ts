import { QueueableTask } from "./queue";
import { Worker } from "./work";
import { GolemConfigError, GolemTimeoutError } from "../error/golem-error";
import { Activity } from "../activity";
import { NetworkNode } from "../network";

export enum TaskState {
  New = "new",
  Queued = "queued",
  Pending = "pending",
  Done = "done",
  Retry = "retry",
  Rejected = "rejected",
}

export type TaskOptions = {
  /** maximum number of retries if task failed due to provider reason, default = 5 */
  maxRetries?: number;
  /** timeout in ms for task execution, including retries, default = 300_000 (5min) */
  timeout?: number;
  /** array of setup functions to run on each activity */
  activityReadySetupFunctions?: Worker<unknown>[];
};

const DEFAULTS = {
  MAX_RETRIES: 5,
  TIMEOUT: 1000 * 60 * 5,
};

/**
 * One computation unit.
 *
 * @description Represents one computation unit that will be run on the one provider machine (e.g. rendering of one frame of an animation).
 */
export class Task<OutputType = unknown> implements QueueableTask {
  private state = TaskState.New;
  private results?: OutputType;
  private error?: Error;
  private retriesCount = 0;
  private listeners = new Set<(state: TaskState) => void>();
  private timeoutId?: NodeJS.Timeout;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly activityReadySetupFunctions: Worker<unknown>[];
  private activity?: Activity;
  private networkNode?: NetworkNode;

  constructor(
    public readonly id: string,
    private worker: Worker<OutputType>,
    options?: TaskOptions,
  ) {
    this.timeout = options?.timeout ?? DEFAULTS.TIMEOUT;
    this.maxRetries = options?.maxRetries ?? DEFAULTS.MAX_RETRIES;
    this.activityReadySetupFunctions = options?.activityReadySetupFunctions ?? [];
    if (this.maxRetries < 0) {
      throw new GolemConfigError("The maxRetries parameter cannot be less than zero");
    }
  }

  onStateChange(listener: (state: TaskState) => void) {
    this.listeners.add(listener);
  }
  cleanup() {
    // prevent memory leaks
    this.listeners.clear();
  }
  init() {
    this.state = TaskState.Queued;
  }

  start(activity: Activity, networkNode?: NetworkNode) {
    this.state = TaskState.Pending;
    this.activity = activity;
    this.networkNode = networkNode;
    this.listeners.forEach((listener) => listener(this.state));
    this.timeoutId = setTimeout(
      () => this.stop(undefined, new GolemTimeoutError(`Task ${this.id} timeout.`), true),
      this.timeout,
    );
  }
  stop(results?: OutputType, error?: Error, retry = true) {
    if (this.isFinished() || this.isRetry()) {
      return;
    }
    clearTimeout(this.timeoutId);
    if (error) {
      this.error = error;
      if (retry && this.retriesCount < this.maxRetries) {
        this.state = TaskState.Retry;
        ++this.retriesCount;
      } else {
        this.state = TaskState.Rejected;
      }
    } else {
      this.state = TaskState.Done;
      this.results = results;
    }
    this.listeners.forEach((listener) => listener(this.state));
  }
  isQueueable(): boolean {
    return this.state === TaskState.New || this.state === TaskState.Retry;
  }
  isRetry(): boolean {
    return this.state === TaskState.Retry;
  }
  isDone(): boolean {
    return this.state === TaskState.Done;
  }
  isFinished(): boolean {
    return this.state === TaskState.Done || this.state === TaskState.Rejected;
  }
  isRejected(): boolean {
    return this.state === TaskState.Rejected;
  }
  isQueued(): boolean {
    return this.state === TaskState.Queued;
  }
  isPending(): boolean {
    return this.state === TaskState.Pending;
  }
  isNew(): boolean {
    return this.state === TaskState.New;
  }
  isFailed(): boolean {
    return this.state === TaskState.Rejected || this.state === TaskState.Retry;
  }
  getResults(): OutputType | undefined {
    return this.results;
  }
  getWorker(): Worker<OutputType> {
    return this.worker;
  }
  getActivityReadySetupFunctions(): Worker<unknown>[] {
    return this.activityReadySetupFunctions;
  }
  getRetriesCount(): number {
    return this.retriesCount;
  }
  getError(): Error | undefined {
    return this.error;
  }
  getActivity(): Activity | undefined {
    return this.activity;
  }
  getNetworkNode(): NetworkNode | undefined {
    return this.networkNode;
  }
}
