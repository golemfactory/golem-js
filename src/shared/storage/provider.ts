export type StorageProviderDataCallback = (data: Uint8Array) => void;

export interface StorageProvider {
  /**
   * Initialize storage provider.
   */
  init(): Promise<void>;

  /**
   * Close storage provider and release all resources.
   */
  close(): Promise<void>;

  /**
   * Return allocated resource URL from Yagna of a file to be downloaded.
   */
  receiveFile(destPath: string): Promise<string>;

  /**
   * Return allocated resource URL from Yagna of a file to be downloaded.
   */
  receiveData(callback: StorageProviderDataCallback): Promise<string>;

  /**
   * Return allocated resource URL from Yagna of a file to be uploaded.
   * @param srcPath
   */
  publishFile(srcPath: string): Promise<string>;

  /**
   * Return allocated resource URL from Yagna of data to be uploaded.
   * @param data
   */
  publishData(data: Uint8Array): Promise<string>;

  /**
   * Release previously allocated resource URL from Yagna.
   * @param urls
   */
  release(urls: string[]): Promise<void>;
}
