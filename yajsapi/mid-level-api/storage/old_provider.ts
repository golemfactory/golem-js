import { provider } from "../../storage/gftp";

export class OldStorageProviderFacade implements StorageProvider {
  private oldProvider;
  // private publishedUrls: string[] = [];
  constructor() {
    this.oldProvider = provider();
  }

  async init() {
    this.oldProvider.ready();
  }

  async download(path: string): Promise<string> {
    const oldDestination = await this.oldProvider.new_destination(path);
    return oldDestination.upload_url();
  }

  async upload(path: string): Promise<string> {
    const source = await this.oldProvider.upload_file(path);
    // this.publishedUrls.push(source.download_url());
    return source.download_url();
  }
  async end() {
    // await this.oldProvider.release(this.publishedUrls);
    await this.oldProvider.done();
  }
}
