import { GftpStorageProvider, StorageProvider } from "../storage";
import fs from "fs";
import jsSha3 from "js-sha3";
import { nullLogger } from "../utils";
import { GolemConfigError } from "../error/golem-error";

/**
 * Helper class to serve a local gvmi file so a provider can
 * download it directly from you. When you start serving the file,
 * the server will calculate the hash automatically.
 */
export class GvmiServer {
  private storageProvider: StorageProvider;
  public readonly fileHash: string;
  private fileUrl?: string;

  constructor(
    private gvmiPath: string,
    storageProvider?: StorageProvider,
  ) {
    this.storageProvider = storageProvider || new GftpStorageProvider(nullLogger());
    if (!fs.existsSync(gvmiPath) || fs.lstatSync(gvmiPath).isDirectory()) {
      throw new GolemConfigError(`File ${gvmiPath} does not exist`);
    }
    this.fileHash = this.calculateFileHash();
  }
  calculateFileHash(): string {
    const fileBuffer = fs.readFileSync(this.gvmiPath);
    return jsSha3.sha3_224(fileBuffer);
  }

  isServing(): boolean {
    return this.fileUrl !== undefined;
  }

  async serve() {
    if (this.isServing()) {
      throw new Error("Already serving");
    }
    await this.storageProvider.init();
    this.fileUrl = await this.storageProvider.publishFile(this.gvmiPath);
  }

  async close() {
    await this.storageProvider.close();
  }

  getImage(): { url: string; hash: string } {
    if (!this.isServing()) {
      throw new GolemConfigError("Local image server is not serving the image, did you forget to call .serve()?");
    }
    return {
      url: this.fileUrl!,
      hash: this.fileHash,
    };
  }
}

/**
 * Serve a local gvmi file so a provider can download it directly from you.
 *
 * @example
 * ```ts
 * const server = serveLocalGvmi("/path/to/your.gvmi");
 * const { url, hash } = server.getImage();
 * const package = Package.create({
 *  imageHash: hash,
 *  imageUrl: url,
 * });
 * ```
 */
export function serveLocalGvmi(gvmiPath: string, storageProvider?: StorageProvider): GvmiServer {
  return new GvmiServer(gvmiPath, storageProvider);
}
