export interface StorageProvider {
  init(): Promise<void>;
  close(): Promise<void>;
  receive(path: string): Promise<string>;
  publish(src: string | Buffer): Promise<string>;
  release(urls: string[]): Promise<void>;
}
