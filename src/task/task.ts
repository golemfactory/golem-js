import { QueueableTask } from "./queue";
import { Worker } from "./work";
import { GolemTimeoutError, GolemUserError } from "../error/golem-error";

export enum TaskState {
  New = "new",
  Retry = "retry",
  Pending = "pending",
  Done = "done",
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

  constructor(
    public readonly id: string,
    private worker: Worker<OutputType>,
    options?: TaskOptions,
  ) {
    this.timeout = options?.timeout ?? DEFAULTS.TIMEOUT;
    this.maxRetries = options?.maxRetries ?? DEFAULTS.MAX_RETRIES;
    this.activityReadySetupFunctions = options?.activityReadySetupFunctions ?? [];
    if (this.maxRetries < 0) {
      throw new GolemUserError("The maxRetries parameter cannot be less than zero");
    }
  }

  onStateChange(listener: (state: TaskState) => void) {
    this.listeners.add(listener);
  }
  cleanup() {
    // prevent memory leaks
    this.listeners.clear();
  }

  start() {
    this.state = TaskState.Pending;
    this.listeners.forEach((listener) => listener(this.state));
    this.timeoutId = setTimeout(
      () => this.stop(undefined, new GolemTimeoutError(`Task ${this.id} timeout`), false),
      this.timeout,
    );
  }
  stop(results?: OutputType, error?: Error, retry = true) {
    clearTimeout(this.timeoutId);
    if (error) {
      ++this.retriesCount;
      this.state = retry && this.retriesCount <= this.maxRetries ? TaskState.Retry : TaskState.Rejected;
      this.error = error;
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
  isPending(): boolean {
    return this.state === TaskState.Pending;
  }
  isNew(): boolean {
    return this.state === TaskState.New;
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
}
