import { Worker } from "./executor";
import { QueueableTask } from "./taskQueue";

export enum TaskState {
  New,
  Retry,
  Pending,
  Done,
  Rejected,
}

const MAX_RETRIES = 5;

export class Task<InputType = unknown, OutputType = unknown> implements QueueableTask {
  private state = TaskState.New;
  private data?: InputType;
  private results?: OutputType;
  private retriesCount = 0;

  constructor(private worker: Worker, private initWorker?: Worker) {}
  start() {
    this.state = TaskState.Pending;
  }
  stop(results?: OutputType, error?: Error, retry = true) {
    if (results) {
      this.state = TaskState.Done;
      this.results = results;
    } else if (error) {
      ++this.retriesCount;
      this.state = retry && this.retriesCount <= MAX_RETRIES ? TaskState.Retry : TaskState.Rejected;
    }
  }
  isQueueable(): boolean {
    return this.state === TaskState.New || this.state === TaskState.Retry;
  }
  isRetry(): boolean {
    return this.state === TaskState.New;
  }
  getResults(): OutputType | undefined {
    return this.results;
  }
  getData(): InputType | undefined {
    return this.data;
  }
  getWorker(): Worker {
    return this.worker;
  }
  getInitWorker(): Worker | undefined {
    return this.initWorker;
  }
}
