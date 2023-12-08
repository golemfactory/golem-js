import { Task } from "./task";
import { GolemError } from "../error/golem-error";

/**
 * @internal
 */
export interface QueueableTask {
  isQueueable(): boolean;
}

/**
 * @internal
 */
export class TaskQueue<T extends QueueableTask = Task> {
  protected itemsStack: Array<T> = [];

  addToEnd(task: T) {
    this._checkIfTaskIsEligibleForAdd(task);
    this.itemsStack.push(task);
  }

  addToBegin(task: T) {
    this._checkIfTaskIsEligibleForAdd(task);
    this.itemsStack.unshift(task);
  }

  get size(): number {
    return this.itemsStack.length;
  }

  get(): T | undefined {
    return this.itemsStack.shift();
  }

  private _checkIfTaskIsEligibleForAdd(task: T) {
    if (!task.isQueueable()) throw new GolemError("You cannot add a task that is not in the correct state");
  }
}
