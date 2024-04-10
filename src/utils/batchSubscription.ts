export class BatchSubscription<T> {
  private readonly subscribers: Set<(event: T[]) => void> = new Set();
  private batch: T[] = [];
  private batchTimeoutId?: NodeJS.Timeout;

  public end(): void {
    this.subscribers.clear();
    if (this.batchTimeoutId) {
      clearTimeout(this.batchTimeoutId);
    }
  }

  constructor(
    private readonly batchSize: number,
    private readonly batchTimeout?: number,
  ) {}

  public subscribe(subscriber: (event: T[]) => void): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  public publish(event: T): void {
    this.batch.push(event);
    if (this.batch.length === this.batchSize) {
      this.publishBatch();
    }
    if (this.batchTimeoutId) {
      clearTimeout(this.batchTimeoutId);
    }
    if (this.batchTimeout) {
      this.batchTimeoutId = setTimeout(() => this.publishBatch(), this.batchTimeout);
    }
  }

  private publishBatch(): void {
    for (const subscriber of this.subscribers) {
      subscriber(this.batch);
    }
    this.batch = [];
    this.batchTimeoutId = undefined;
  }
}
