import { StorageProvider } from "../../yajsapi/storage/provider";

export class StorageProviderMock implements StorageProvider {
  receive(path: string): Promise<string> {
    return Promise.resolve("");
  }

  close(): Promise<void> {
    return Promise.resolve(undefined);
  }

  init(): Promise<void> {
    return Promise.resolve(undefined);
  }

  publish(path: string): Promise<string> {
    return Promise.resolve("");
  }

  release(urls: string[]): Promise<void> {
    return Promise.resolve();
  }
}
