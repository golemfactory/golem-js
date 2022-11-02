import { StatusableTask } from '../../yajsapi/executor/taskqueue';

export enum TaskState {
    New,
    Retry,
    Pending,
    Done,
}

export default class TaskMock implements StatusableTask {
    constructor(private results, private state: TaskState) {
    }

    public isPending() {
        return this.state == TaskState.Pending;
    }

    public isDone() {
        return this.state == TaskState.Done;
    }

    public getResults() {
        return this.results;
    }

    public isRetry() {
        return this.state == TaskState.Retry;
    }
}