/**
 * @template T
 */
export class TaskQueue<Task extends QueueableTask> {
  protected itemsStack: Array<Task> = [];

  /**
   * Add tasks to the stack
   * @description Task isRetry() will be added on the beginning of the task queue,
   * otherwise will be added to the end of the queue
   * @param {T} task
   * @throws {TaskNotEligibleError} - Throws exception if task is eligible for add
   */
  add(task: Task): void {
    this._checkIfTaskIsEligibleForAdd(task);
    if (task.isRetry()) {
      this.itemsStack.unshift(task);
    } else {
      this.itemsStack.push(task);
    }
  }

  /**
   * Check if task is eligible for add
   * @param task
   * @throws {TaskNotEligibleError} - Throws exception if task is eligible for add
   */
  private _checkIfTaskIsEligibleForAdd(task: Task) {
    if (task.isQueueable()) {
      return true;
    }
    throw new TaskNotEligibleError("You can not add a task that have state other than New or Retry.");
  }

  /**
   * Return current amount of tasks in the stack
   * @return {number} - amount of tasks in the stack
   */
  length(): number {
    return this.itemsStack.length;
  }

  /**
   * Get first task in the stack, and remove it from the stack
   * @description If there is no task in the stack, returns "undefined"
   * @return {T|undefined}
   */
  get(): Task | undefined {
    return this.itemsStack.shift();
  }
}

export interface QueueableTask {
  isQueueable(): boolean;
  isRetry(): boolean;
}

export class TaskNotEligibleError extends Error {}
