/**
 * This Utility was created to replace the browser's unsupported "jp-csp".
 * It is intended to provide minimal functionality to run yajsapi correctly
 * with the thought of removing it after API refactoring. The naming of methods
 * and property has been adjusted to replace the "js-csp" library as easily
 * as possible.
 */
type mixed = string | number | object | boolean;
type Task = mixed;

export class Channel {
    name: string | null = null;
    tasks: Array<Task> = [];
    closed = false;

    constructor(name: null | string = null) {
        this.name = name;
    }

    /**
     * Put Task on task stack
     * @param task
     */
    put(task: Task): void {
        this.tasks.push(task);
    }

    /**
     * Take task from task stack
     */
    take(): Task | undefined {
        return this.tasks.shift();
    }

    /**
     * Close channel
     */
    close(): void {
        this.closed = true;
    }
}

/**
 * Create a new Channel and return a new Channel object
 */
export function chan(name: string | null = null) {
    //console.log('chan', name)
    return new Channel(name);
}

/**
 * Put a new Task for a given Channel stack
 * @param channel - destination Channel
 * @param task - Task to stack on
 */
export function putAsync(channel: Channel, task: Task): void {
    //console.log('putAsync', channel.name, task)
    channel.put(task);
}

/**
 * Take the latest Task from a given Channel
 * and run call back on a result if the callback
 * is provided
 * @param channel - source Channel
 * @param callback - callback function to run on the result
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export function takeAsync(channel: Channel, callback: Function | null): void {
    //console.log('takeAsync', channel.name, callback)
    const result = channel.take();
    if (result && callback) {
        callback(result);
    }
}