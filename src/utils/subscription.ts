import { withTimeout } from "./timeout";

export class Subscription<T> {
  private readonly subscribers: Set<(event: T) => void> = new Set();
  private cleanup?: () => void;

  public setCleanup(cleanup: () => void): void {
    this.cleanup = cleanup;
  }

  public end(): void {
    this.subscribers.clear();
    if (this.cleanup) {
      this.cleanup();
    }
  }

  public subscribe(subscriber: (event: T) => void): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  public publish(event: T): void {
    for (const subscriber of this.subscribers) {
      subscriber(event);
    }
  }

  public filter(matcher: (event: T) => boolean): Subscription<T> {
    const filteredSubscription = new Subscription<T>();
    const unsubscribe = this.subscribe((event) => {
      if (matcher(event)) {
        filteredSubscription.publish(event);
      }
    });
    filteredSubscription.setCleanup(unsubscribe);
    return filteredSubscription;
  }

  public async waitFor(matcher: (event: T) => boolean, opts: { timeout?: number }): Promise<T> {
    const promise = new Promise<T>((resolve) => {
      const unsubscribe = this.subscribe((event) => {
        if (matcher(event)) {
          resolve(event);
          unsubscribe();
        }
      });
    });

    if (!opts.timeout) {
      return promise;
    }
    return withTimeout(promise, opts.timeout);
  }
}
