export interface StorageProvider {
  init(): Promise<void>;
  close(): Promise<void>;
  receive(path: string): Promise<string>;
  publish(path: string): Promise<string>;
  release(urls: string[]): Promise<void>;
}
