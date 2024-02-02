import { StorageProvider } from "../../../src/storage";
import { Logger, nullLogger } from "../../../src/utils";
import { StorageProviderDataCallback } from "../../../src/storage/provider";

export class StorageProviderMock implements StorageProvider {
  private logger: Logger;

  constructor(options?: { logger?: Logger }) {
    this.logger = options?.logger || nullLogger();
  }

  receiveFile(path: string): Promise<string> {
    this.logger.debug(`File received`, { path });
    return Promise.resolve("");
  }

  receiveData(callback: StorageProviderDataCallback): Promise<string> {
    this.logger.debug(`Data received`);
    return Promise.resolve("");
  }

  close(): Promise<void> {
    this.logger.debug(`Storage provider closed`);
    return Promise.resolve(undefined);
  }

  init(): Promise<void> {
    this.logger.debug(`Storage provider started`);
    return Promise.resolve(undefined);
  }

  publishFile(src: string): Promise<string> {
    this.logger.debug(`File published`, { src });
    return Promise.resolve("");
  }

  publishData(data: Uint8Array): Promise<string> {
    this.logger.debug(`Data published`, { data });
    return Promise.resolve("");
  }

  release(urls: string[]): Promise<void> {
    this.logger.debug(`Urls released`, { urls });
    return Promise.resolve();
  }
}

export const storageProviderMock = new StorageProviderMock();
