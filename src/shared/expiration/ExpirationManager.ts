import { Logger } from "../utils";

/**
 * Simple utility class that runs all given cleanup functions on a set interval.
 * It can be used to manage expiration of cache entries.
 */
export class ExpirationManager {
  private intervalId: NodeJS.Timeout | null = null;
  private trackedItems: Map<string, number> = new Map();
  private cleanupFunctions: Set<(id: string) => void | Promise<void>> = new Set();

  private ttlMs: number;
  private intervalMs: number;
  private logger: Logger;

  constructor(options: { timeToLiveMs: number; intervalMs: number; logger: Logger }) {
    this.ttlMs = options.timeToLiveMs;
    this.intervalMs = options.intervalMs;
    this.logger = options.logger;
  }

  start() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      this.#cleanupExpiredItems().catch((error) => {
        this.logger.error("Error occurred in ExpirationManager", { error });
      });
    }, this.intervalMs);
  }

  registerObjectForCleanup(id: string) {
    if (this.trackedItems.has(id)) {
      this.trackedItems.delete(id);
    }
    this.trackedItems.set(id, Date.now() + this.ttlMs);
  }

  registerCleanupFunction(fn: (id: string) => void) {
    this.cleanupFunctions.add(fn);
    return () => this.unregisterCleanupFunction(fn);
  }

  unregisterObjectForCleanup(id: string) {
    this.trackedItems.delete(id);
  }

  unregisterCleanupFunction(fn: (id: string) => void) {
    this.cleanupFunctions.delete(fn);
  }

  async #cleanupExpiredItems() {
    const now = Date.now();
    const expiredItems: string[] = [];
    for (const [id, expirationDate] of this.trackedItems) {
      if (expirationDate <= now) {
        this.logger.debug(`Item with id ${id} has expired and will be cleaned up.`);
        expiredItems.push(id);
      } else {
        // JS Map is guaranteed to maintain insertion order
        // so when we find the first item that's not expired we
        // can safely exit the loop
        break;
      }
    }

    const allProcessingPromises = expiredItems.map(async (id) => {
      this.trackedItems.delete(id);
      const cleanupPromises = [...this.cleanupFunctions].map((fn) => fn(id));
      try {
        await Promise.all(cleanupPromises);
      } catch (error) {
        this.logger.error(`Error occurred in cleanup functions for id ${id}`, { error, id });
      }
    });

    await Promise.all(allProcessingPromises);
  }

  stopAndReset() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.trackedItems.clear();
    this.cleanupFunctions.clear();
  }
}
