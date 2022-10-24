import { provider } from "./gftp";
import { StorageProvider } from "./provider";
import { runtimeContextChecker } from "../utils";

export class GftpStorageProvider implements StorageProvider {
  private gftpProvider;
  private publishedUrls: string[] = [];
  constructor(prov?) {
    if (runtimeContextChecker.isBrowser)
      throw new Error(`File transfer by GFTP module is unsupported in the browser context.`);
    this.gftpProvider = prov || provider();
  }

  async init() {
    this.gftpProvider.ready();
  }

  async receive(path: string): Promise<string> {
    const oldDestination = await this.gftpProvider.new_destination(path);
    return oldDestination.upload_url();
  }

  async publish(src: string | Buffer): Promise<string> {
    if (typeof src !== "string" && !Buffer.isBuffer(src)) throw new Error("[StorageProvider] Unsupported source type");
    const source =
      typeof src === "string" ? await this.gftpProvider.upload_file(src) : await this.gftpProvider.upload_bytes(src);
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
