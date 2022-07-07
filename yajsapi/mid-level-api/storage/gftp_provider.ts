import { provider } from "../../storage/gftp";
import { StorageProvider } from "./provider";

export class GftpStorageProvider implements StorageProvider {
  private gftpProvider;
  private publishedUrls: string[] = [];
  constructor() {
    this.gftpProvider = provider();
  }

  async init() {
    this.gftpProvider.ready();
  }

  async receive(path: string): Promise<string> {
    const oldDestination = await this.gftpProvider.new_destination(path);
    return oldDestination.upload_url();
  }

  async publish(path: string): Promise<string> {
    const source = await this.gftpProvider.upload_file(path);
    this.publishedUrls.push(source.download_url());
    return source.download_url();
  }

  async release(urls: string[]): Promise<void> {
    await this.gftpProvider.release(urls);
  }
  async close() {
    await this.gftpProvider.release(this.publishedUrls);
    await this.gftpProvider.done();
  }
}
