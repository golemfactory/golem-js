export interface QueueableTask {
  isQueueable(): boolean;
}
export class TaskNotEligibleError extends Error {}

export class TaskQueue<Task extends QueueableTask> {
  protected itemsStack: Array<Task> = [];

  addToEnd(task: Task) {
    this._checkIfTaskIsEligibleForAdd(task);
    this.itemsStack.push(task);
  }

  addToBegin(task: Task) {
    this._checkIfTaskIsEligibleForAdd(task);
    this.itemsStack.unshift(task);
  }

  get size(): number {
    return this.itemsStack.length;
  }

  get(): Task | undefined {
    return this.itemsStack.shift();
  }

  private _checkIfTaskIsEligibleForAdd(task: Task) {
    if (!task.isQueueable()) throw new TaskNotEligibleError("You cannot add a task that is not in the correct state");
  }
}
