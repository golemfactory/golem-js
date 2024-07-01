export class CacheService<T> {
  private readonly storage = new Map<string, T>();

  public set(key: string, value: T) {
    this.storage.set(key, value);

    return value;
  }

  public get(key: string) {
    return this.storage.get(key);
  }

  public delete(key: string) {
    return this.storage.delete(key);
  }

  public has(key: string) {
    return this.storage.has(key);
  }

  public getAll(): T[] {
    return [...this.storage.values()];
  }

  public flushAll() {
    return this.storage.clear();
  }
}
