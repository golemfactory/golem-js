import { QueueableTask } from "../../../yajsapi/task/index.js";

export enum TaskState {
  New,
  Retry,
  Pending,
  Done,
}

export default class TaskMock implements QueueableTask {
  constructor(private results, private state: TaskState) {}

  public isQueueable() {
    return this.state == TaskState.Retry || this.state == TaskState.New;
  }

  public getResults() {
    return this.results;
  }

  public isRetry() {
    return this.state == TaskState.Retry;
  }
}
