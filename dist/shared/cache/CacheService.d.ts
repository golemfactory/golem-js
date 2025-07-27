export declare class CacheService<T> {
    private readonly storage;
    set(key: string, value: T): T;
    get(key: string): T | undefined;
    delete(key: string): boolean;
    has(key: string): boolean;
    getAll(): T[];
    flushAll(): void;
}
