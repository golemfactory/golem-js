/**
 * Simple sort-based priority queue.
 */
export class PriorityQueue<T> {
  private queue: T[] = [];

  public constructor(private compare: (a: T, b: T) => number) {}

  public push(item: T): void {
    this.queue.push(item);
    this.queue.sort(this.compare);
  }

  public pop(): T | undefined {
    return this.queue.shift();
  }

  public size(): number {
    return this.queue.length;
  }

  public clear(): void {
    this.queue = [];
  }

  public toArray(): T[] {
    return [...this.queue];
  }
}
