import { QueueableTask, Worker } from ".";

export enum TaskState {
  New,
  Retry,
  Pending,
  Done,
  Rejected,
}

const MAX_RETRIES = 5;

/**
 * One computation unit.
 *
 * @description Represents one computation unit that will be run on the one provider machine (e.g. rendering of one frame of an animation).
 */
export class Task<InputType = unknown, OutputType = unknown> implements QueueableTask {
  private state = TaskState.New;
  private results?: OutputType;
  private error?: Error;
  private retriesCount = 0;

  constructor(
    public readonly id: string,
    private worker: Worker<InputType, OutputType>,
    private data?: InputType,
    private initWorker?: Worker<undefined>,
    private maxTaskRetries: number = MAX_RETRIES
  ) {}

  start() {
    this.state = TaskState.Pending;
  }
  stop(results?: OutputType, error?: Error, retry = true) {
    if (error) {
      ++this.retriesCount;
      this.state = retry && this.retriesCount <= this.maxTaskRetries ? TaskState.Retry : TaskState.Rejected;
      this.error = error;
    } else {
      this.state = TaskState.Done;
      this.results = results;
    }
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
  getData(): InputType | undefined {
    return this.data;
  }
  getWorker(): Worker<InputType> {
    return this.worker;
  }
  getInitWorker(): Worker<undefined> | undefined {
    return this.initWorker;
  }
  getRetriesCount(): number {
    return this.retriesCount;
  }
  getError(): Error | undefined {
    return this.error;
  }
}
