export interface StorageProvider {
  init(): Promise<void>;
  end(): Promise<void>;
  download(path: string): Promise<string>;
  upload(path: string): Promise<string>;
}
