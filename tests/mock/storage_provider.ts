import { StorageProvider } from "../../yajsapi/mid-level-api/storage/provider";

export class StorageProviderMock implements StorageProvider {
  download(path: string): Promise<string> {
    return Promise.resolve("");
  }

  end(): Promise<void> {
    return Promise.resolve(undefined);
  }

  init(): Promise<void> {
    return Promise.resolve(undefined);
  }

  upload(path: string): Promise<string> {
    return Promise.resolve("");
  }
}
