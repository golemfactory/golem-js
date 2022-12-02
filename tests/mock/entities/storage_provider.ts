import { StorageProvider } from "../../../yajsapi/storage/provider";
import { Logger } from "../../../yajsapi/utils";

export class StorageProviderMock implements StorageProvider {
  private logger?: Logger;

  constructor(options?: { logger?: Logger }) {
    this.logger = options?.logger;
  }

  receive(path: string): Promise<string> {
    this.logger?.debug(`File received: ${path}`);
    return Promise.resolve("");
  }

  close(): Promise<void> {
    this.logger?.debug(`Storage provider closed`);
    return Promise.resolve(undefined);
  }

  init(): Promise<void> {
    this.logger?.debug(`Storage provider started`);
    return Promise.resolve(undefined);
  }

  publish(src: string | Buffer): Promise<string> {
    if (typeof src === "string") this.logger?.debug(`File published: ${src}`);
    else this.logger?.debug(`Json published: ${src}`);
    return Promise.resolve("");
  }

  release(urls: string[]): Promise<void> {
    this.logger?.debug(`Urls released: ${urls}`);
    return Promise.resolve();
  }
}

export const storageProviderMock = new StorageProviderMock();
