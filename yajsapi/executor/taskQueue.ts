export interface QueueableTask {
  isQueueable(): boolean;
}

export class TaskQueue<Task extends QueueableTask> {
  protected itemsStack: Array<Task> = [];

  addToEnd(task: Task) {
    if (!task.isQueueable()) throw "Error todo";
    this.itemsStack.push(task);
  }

  addToBegin(task: Task) {
    if (!task.isQueueable()) throw "Error todo";
    this.itemsStack.unshift(task);
  }

  size(): number {
    return this.itemsStack.length;
  }

  get(): Task | undefined {
    return this.itemsStack.shift();
  }
}
