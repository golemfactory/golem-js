import { FileServerEntry, IFileServer } from "../../activity";
import { GolemConfigError, GolemInternalError } from "../error/golem-error";
import { StorageProvider } from "./provider";
import fs from "fs";
import jsSha3 from "js-sha3";

/**
 * This class provides GFTP based implementation of the IFileServer interface used in the SDK
 */
export class GftpServerAdapter implements IFileServer {
  private published = new Map<string, FileServerEntry>();

  constructor(private readonly storage: StorageProvider) {}

  async publishFile(sourcePath: string) {
    if (!this.storage.isReady()) {
      throw new GolemInternalError("The GFTP server as to be initialized before publishing a file ");
    }

    if (!fs.existsSync(sourcePath) || fs.lstatSync(sourcePath).isDirectory()) {
      throw new GolemConfigError(`File ${sourcePath} does not exist o is a directory`);
    }

    const fileUrl = await this.storage.publishFile(sourcePath);
    const fileHash = await this.calculateFileHash(sourcePath);

    const entry = {
      fileUrl,
      fileHash,
    };

    this.published.set(sourcePath, entry);

    return entry;
  }

  public isServing() {
    return this.published.size !== 0;
  }

  getPublishInfo(sourcePath: string) {
    return this.published.get(sourcePath);
  }

  isFilePublished(sourcePath: string): boolean {
    return this.published.has(sourcePath);
  }

  private async calculateFileHash(localPath: string): Promise<string> {
    const fileStream = fs.createReadStream(localPath);
    const hash = jsSha3.sha3_224.create();

    return new Promise((resolve, reject) => {
      fileStream.on("data", (chunk: Buffer) => hash.update(chunk));
      fileStream.on("end", () => resolve(hash.hex()));
      fileStream.on("error", (err) => reject(new GolemInternalError(`Error calculating file hash: ${err}`, err)));
    });
  }
}
