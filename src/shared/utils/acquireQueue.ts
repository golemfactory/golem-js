import { GolemInternalError } from "../error/golem-error";
import { anyAbortSignal, createAbortSignalFromTimeout } from "./abortSignal";

/**
 * `Promise.withResolvers` is only available in Node 22.0.0 and later.
 */
function withResolvers<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  return { resolve, reject, promise };
}

type Acquire<T> = (item: T) => void;

/**
 * A queue of acquirers waiting for an item.
 * use `get` to queue up for the next available item.
 * use `put` to give the item to the next acquirer.
 */
export class AcquireQueue<T> {
  private queue: Acquire<T>[] = [];
  private abortController = new AbortController();

  /**
   * Release (reject) all acquirers.
   * Essentially this is a way to reset the queue.
   */
  public releaseAll() {
    this.abortController.abort();
    this.queue = [];
    this.abortController = new AbortController();
  }

  /**
   * Queue up for the next available item.
   */
  public async get(signalOrTimeout?: number | AbortSignal): Promise<T> {
    const signal = anyAbortSignal(createAbortSignalFromTimeout(signalOrTimeout), this.abortController.signal);
    signal.throwIfAborted();
    const { resolve, promise } = withResolvers<T>();
    this.queue.push(resolve);

    const abortPromise = new Promise<never>((_, reject) => {
      signal.addEventListener("abort", () => {
        this.queue = this.queue.filter((r) => r !== resolve);
        reject(signal.reason);
      });
    });
    return Promise.race([promise, abortPromise]);
  }

  /**
   * Are there any acquirers waiting for an item?
   */
  public hasAcquirers() {
    return this.queue.length > 0;
  }

  /**
   * Give the item to the next acquirer.
   * If there are no acquirers, throw an error. You should check `hasAcquirers` before calling this method.
   */
  public put(item: T) {
    if (!this.hasAcquirers()) {
      throw new GolemInternalError("No acquirers waiting for the item");
    }
    const resolve = this.queue.shift()!;
    resolve(item);
  }

  public size() {
    return this.queue.length;
  }
}
