import { StorageProvider, StorageProviderDataCallback } from "./provider";
import { GolemError } from "../error/golem-error";

/**
 * Null Storage Provider.
 *
 * Blocks all storage operations. Any attempt to use storage will result in an error.
 *
 * This will be the default storage provider if no default storage provider is available
 * for the platform the SDK is running on.
 *
 * @category mid-level
 */
export class NullStorageProvider implements StorageProvider {
  close(): Promise<void> {
    return Promise.resolve(undefined);
  }

  init(): Promise<void> {
    return Promise.resolve(undefined);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  publishData(src: Uint8Array): Promise<string> {
    return Promise.reject(new GolemError("NullStorageProvider does not support cannot upload data"));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  publishFile(src: string): Promise<string> {
    return Promise.reject(new GolemError("NullStorageProvider does not support cannot upload files"));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  receiveFile(path: string): Promise<string> {
    return Promise.reject(new GolemError("NullStorageProvider does not support cannot download files"));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  receiveData(callback: StorageProviderDataCallback): Promise<string> {
    return Promise.reject(new GolemError("NullStorageProvider does not support cannot download data"));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  release(urls: string[]): Promise<void> {
    return Promise.resolve(undefined);
  }
}
