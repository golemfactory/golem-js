import { StorageProvider } from "./provider";
import { defaultLogger, isBrowser, Logger } from "../utils";
import path from "path";
import fs from "fs";
import cp from "child_process";
import { GolemInternalError, GolemUserError } from "../error/golem-error";
import { v4 } from "uuid";
import AsyncLock from "async-lock";

export class GftpStorageProvider implements StorageProvider {
  private gftpServerProcess?: cp.ChildProcess;
  private logger: Logger;

  /**
   * All published URLs to be release on close().
   * @private
   */
  private publishedUrls = new Set<string>();

  private isInitialized = false;

  private reader?: AsyncIterableIterator<string>;
  /**
   * lock against parallel writing to stdin in gftp process
   * @private
   */
  private lock = new AsyncLock();

  constructor(logger?: Logger) {
    if (isBrowser) {
      throw new GolemUserError(`File transfer by GFTP module is unsupported in the browser context.`);
    }
    this.logger = logger || defaultLogger("storage");
  }

  async init() {
    if (this.isInitialized) {
      this.logger.warn("GFTP init attempted even though it was already ready - check the logic of your application");
      return;
    }

    await this.startGftpServer();

    this.logger.info(`GFTP Version: ${await this.jsonRpc("version")}`);
  }

  private startGftpServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.debug("Starting GFTP server");

      this.gftpServerProcess = cp.spawn("gftp", ["server"]);

      this.gftpServerProcess.on("spawn", () => {
        this.logger.info("GFTP server spawned");
        this.isInitialized = true;
        resolve();
      });

      this.gftpServerProcess.on("error", (error) => {
        this.logger.error("Error while spawning GFTP server", error);
        reject(error);
      });

      this.gftpServerProcess.on("close", (code, signal) => {
        this.logger.info("GFTP server closed", { code, signal });
        this.isInitialized = false;
      });

      this.gftpServerProcess?.stdout?.setEncoding("utf-8");
      this.gftpServerProcess?.stderr?.setEncoding("utf-8");

      this.reader = this.gftpServerProcess?.stdout?.iterator();
    });
  }

  private async generateTempFileName(): Promise<string> {
    const { randomUUID } = await import("crypto");
    const tmp = await import("tmp");
    const fileName = path.join(tmp.dirSync().name, randomUUID().toString());
    if (fs.existsSync(fileName)) fs.unlinkSync(fileName);
    return fileName;
  }

  async receiveFile(path: string): Promise<string> {
    const { url } = await this.jsonRpc("receive", { output_file: path });
    return url;
  }

  receiveData(): Promise<string> {
    throw new GolemUserError("receiveData is not implemented in GftpStorageProvider");
  }

  async publishFile(src: string): Promise<string> {
    const url = await this.uploadFile(src);
    this.publishedUrls.add(url);
    return url;
  }

  async publishData(src: Uint8Array): Promise<string> {
    let url: string;

    if (Buffer.isBuffer(src)) {
      url = await this.uploadBytes(src);
    } else {
      url = await this.uploadBytes(Buffer.from(src));
    }

    this.publishedUrls.add(url);

    return url;
  }

  release(): Promise<void> {
    // NOTE: Due to GFTP's handling of file Ids (hashes), all files with same content will share IDs, so releasing
    // one might break transfer of another one. Therefore, we release all files on close().
    return Promise.resolve(undefined);
  }

  private async releaseAll(): Promise<void> {
    const urls = Array.from(this.publishedUrls).filter((url) => !!url);

    if (urls.length) {
      await this.jsonRpc("close", { urls });
    }
  }

  async close() {
    if (this.isInitialized) {
      await this.releaseAll();
      this.gftpServerProcess?.kill();
    }
  }

  private async jsonRpc(method: string, params: Record<string, string | number | string[]> = {}) {
    return this.lock.acquire("gftp-io", async () => {
      if (!this.isInitialized) {
        throw new GolemInternalError(
          `GFTP was not initialized when calling JSON-RPC ${method} with ${JSON.stringify(params)}`,
        );
      }

      const callId = v4();

      const request = {
        jsonrpc: "2.0",
        id: callId,
        method: method,
        params: params,
      };

      const query = `${JSON.stringify(request)}\n`;

      this.logger.debug("Sending GFTP command", { request });
      this.gftpServerProcess?.stdin?.write(query);

      const value = (await this.reader?.next())?.value;
      if (!value) {
        throw new GolemInternalError("Unable to get GFTP command result");
      }

      const { result } = JSON.parse(value);
      if (result === undefined) {
        throw new GolemInternalError(value);
      }

      return result;
    });
  }

  private async uploadStream(stream: AsyncGenerator<Buffer>): Promise<string> {
    // FIXME: temp file is never deleted.
    const fileName = await this.generateTempFileName();
    const wStream = fs.createWriteStream(fileName, {
      encoding: "binary",
    });
    // eslint-disable-next-line no-async-promise-executor
    await new Promise(async (fulfill) => {
      wStream.once("finish", fulfill);
      for await (const chunk of stream) {
        wStream.write(chunk);
      }
      wStream.end();
    });
    const links = await this.jsonRpc("publish", { files: [fileName.toString()] });
    if (links.length !== 1) throw "invalid gftp publish response";
    return links[0]?.url;
  }

  private async uploadBytes(data: Buffer): Promise<string> {
    return await this.uploadStream(
      (async function* () {
        yield data;
      })(),
    );
  }

  private async uploadFile(file: string): Promise<string> {
    const links = await this.jsonRpc("publish", { files: [file.toString()] });
    return links[0]?.url;
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}
