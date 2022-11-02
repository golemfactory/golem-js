export default class TaskQueue<T extends StatusableTask> {
    protected itemsStack: Array<T> = [];

    /**
     * Add tasks to the stack
     * Task isRetry() will be added on the beginning of the task queue, otherwise will be added to the end of the queue
     * @param {T} task
     * @throws {TaskIsPendingError|TaskIsDoneError} - Throws exception if task is eligible for add
     */
    add(task: T): void {
        this._checkIfTaskIsEligibleForAdd(task);
        if(task.isRetry()) {
            this.itemsStack.unshift(task);
        } else {
            this.itemsStack.push(task);
        }
    }

    /**
     * Check if task is eligible for add
     * @param task
     * @throws {TaskIsPendingError|TaskIsDoneError} - Throws exception if task is eligible for add
     */
    private _checkIfTaskIsEligibleForAdd(task: T) {
        if(task.isDone())
            throw new TaskIsDoneError();
        if(task.isPending())
            throw new TaskIsPendingError();

        return true;
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
    get(): T | undefined {
        return this.itemsStack.shift();
    }
}


// TODO consider coupling with Task object or just change generic to the Task object
interface StatusableTask {
    isRetry(): boolean;
    isPending(): boolean;
    isDone(): boolean;
}

export abstract class TaskNotEligibleError extends Error {}

export class TaskIsPendingError extends TaskNotEligibleError {
    constructor() {
        super('Given task is pending and can not be added to the TaskQueue');
    }
}

export class TaskIsDoneError extends TaskNotEligibleError {
    constructor() {
        super('Given task is already done and can not be added to the TaskQueue');
    }
}