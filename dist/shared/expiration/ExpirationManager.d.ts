import { Logger } from "../utils";
/**
 * Simple utility class that runs all given cleanup functions on a set interval.
 * It can be used to manage expiration of cache entries.
 */
export declare class ExpirationManager {
    #private;
    private intervalId;
    private trackedItems;
    private cleanupFunctions;
    private ttlMs;
    private intervalMs;
    private logger;
    constructor(options: {
        timeToLiveMs: number;
        intervalMs: number;
        logger: Logger;
    });
    start(): void;
    registerObjectForCleanup(id: string): void;
    registerCleanupFunction(fn: (id: string) => void): () => void;
    unregisterObjectForCleanup(id: string): void;
    unregisterCleanupFunction(fn: (id: string) => void): void;
    stopAndReset(): void;
}
