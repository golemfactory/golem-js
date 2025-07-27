/**
 * A queue of acquirers waiting for an item.
 * use `get` to queue up for the next available item.
 * use `put` to give the item to the next acquirer.
 */
export declare class AcquireQueue<T> {
    private queue;
    private abortController;
    /**
     * Release (reject) all acquirers.
     * Essentially this is a way to reset the queue.
     */
    releaseAll(): void;
    /**
     * Queue up for the next available item.
     */
    get(signalOrTimeout?: number | AbortSignal): Promise<T>;
    /**
     * Are there any acquirers waiting for an item?
     */
    hasAcquirers(): boolean;
    /**
     * Give the item to the next acquirer.
     * If there are no acquirers, throw an error. You should check `hasAcquirers` before calling this method.
     */
    put(item: T): void;
    size(): number;
}
