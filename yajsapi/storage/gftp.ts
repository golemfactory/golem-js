import { StorageProvider, StorageProviderDataCallback } from "./provider";
import { Logger, runtimeContextChecker } from "../utils";
import path from "path";
import fs from "fs";
import { chomp, chunksToLinesAsync, streamEnd, streamWrite } from "@rauschma/stringio";
import cp from "child_process";

export class GftpStorageProvider implements StorageProvider {
  private gftpServerProcess;
  private reader;

  /**
   * All published URLs to be release on close().
   * @private
   */
  private publishedUrls = new Set<string>();

  private isInitialized = false;

  constructor(private logger?: Logger) {
    if (runtimeContextChecker.isBrowser) {
      throw new Error(`File transfer by GFTP module is unsupported in the browser context.`);
    }
  }

  async init() {
    if (this.isInitialized) return;
    this.gftpServerProcess = cp.spawn("gftp server", [], { shell: true });
    this.gftpServerProcess?.stdout?.setEncoding("utf-8");
    this.gftpServerProcess?.stderr?.setEncoding("utf-8");
    this.gftpServerProcess.on("error", (error) => this.logger?.error(error));
    this.gftpServerProcess.stderr.on("data", (data) => this.logger?.error(`GFTP Error: ${data}`));
    this.logger?.info(`GFTP Version: ${await this.jsonrpc("version")}`);
    this.isInitialized = true;
  }

  isInitiated() {
    return !!this.gftpServerProcess;
  }

  private async generateTempFileName(): Promise<string> {
    const { randomUUID } = await import("crypto");
    const tmp = await import("tmp");
    const file_name = path.join(tmp.dirSync().name, randomUUID().toString());
    if (fs.existsSync(file_name)) fs.unlinkSync(file_name);
    return file_name;
  }

  private getGftpServerProcess() {
    return this.gftpServerProcess;
  }

  async receiveFile(path: string): Promise<string> {
    const { url } = await this.jsonrpc("receive", { output_file: path });
    return url;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  receiveData(callback: StorageProviderDataCallback): Promise<string> {
    throw new Error("receiveData is not implemented in GftpStorageProvider");
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  release(urls: string[]): Promise<void> {
    // NOTE: Due to GFTP's handling of file Ids (hashes), all files with same content will share IDs, so releasing
    // one might break transfer of another one. Therefore, we release all files on close().
    return Promise.resolve(undefined);
  }

  private async releaseAll(): Promise<void> {
    if (!this.publishedUrls.size) {
      return;
    }

    await this.jsonrpc("close", { urls: Array.from(this.publishedUrls) });
  }

  async close() {
    await this.releaseAll();
    const stream = this.getGftpServerProcess();
    if (stream) await streamEnd(this.getGftpServerProcess().stdin);
  }

  private async jsonrpc(method: string, params: object = {}) {
    if (!this.isInitiated()) await this.init();
    if (!this.reader) this.reader = this.readStream(this.getGftpServerProcess().stdout);
    const paramsStr = JSON.stringify(params);
    const query = `{"jsonrpc": "2.0", "id": "1", "method": "${method}", "params": ${paramsStr}}\n`;
    let valueStr = "";
    await streamWrite(this.getGftpServerProcess().stdin, query);
    try {
      const { value } = await this.reader.next();
      if (!value) throw "Unable to get GFTP command result";
      const { result } = JSON.parse(value as string);
      valueStr = value;
      if (result === undefined) throw value;
      return result;
    } catch (error) {
      throw Error(`GFTP error. query: ${query} value: ${valueStr} error: ${JSON.stringify(error)}`);
    }
  }

  async* readStream(readable) {
    for await (const line of chunksToLinesAsync(readable)) {
      yield chomp(line);
    }
  }

  private async uploadStream(stream: AsyncGenerator<Buffer>): Promise<string> {
    // FIXME: temp file is never deleted.
    const file_name = await this.generateTempFileName();
    const wStream = fs.createWriteStream(file_name, {
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
    const links = await this.jsonrpc("publish", { files: [file_name.toString()] });
    if (links.length !== 1) throw "invalid gftp publish response";
    return links[0]?.url;
  }

  private async uploadBytes(data: Buffer): Promise<string> {
    return await this.uploadStream(
      (async function* () {
        yield data;
      })()
    );
  }

  private async uploadFile(file: string): Promise<string> {
    const links = await this.jsonrpc("publish", { files: [file.toString()] });
    return links[0]?.url;
  }
}
