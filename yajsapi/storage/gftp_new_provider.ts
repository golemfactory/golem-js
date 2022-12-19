import { StorageProvider } from "./provider";
import { runtimeContextChecker } from "../utils";
import { v4 as uuid } from "uuid";
import path from "path";
import fs from "fs";
import tmp from "tmp";
import { GftpDriver } from "./gftp_driver";
import { chomp, chunksToLinesAsync, streamWrite } from "@rauschma/stringio";

const TMP_DIR = tmp.dirSync().name;

export class GftpNewProvider implements StorageProvider {
  private gftpServerInstance;
  private reader;
  private logger;
  private publishedUrls: string[] = [];
  constructor() {
    if (runtimeContextChecker.isBrowser) {
      throw new Error(`File transfer by GFTP module is unsupported in the browser context.`);
    }
  }

  async init() {
    this.gftpServerInstance = new GftpDriver();
    await this.gftpServerInstance.init();
  }

  private generateTempFileName(): string {
    const file_name = path.join(TMP_DIR, uuid().toString());
    if (fs.existsSync(file_name)) fs.unlinkSync(file_name);
    return file_name;
  }

  private getGftpServerInstance() {
    // TODO if instane is running
    return this.gftpServerInstance;
  }

  async receive(path: string): Promise<string> {
    return await this.jsonrpc("receive", { path });
    const oldDestination = await this.getGftpServerInstance().receive(path);
    return oldDestination.upload_url();
  }

  async publish(src: string | Buffer): Promise<string> {
    if (typeof src !== "string" && !Buffer.isBuffer(src)) throw new Error("[StorageProvider] Unsupported source type");
    const source =
      typeof src === "string"
        ? await this.getGftpServerInstance().upload_file(src)
        : await this.getGftpServerInstance().upload_bytes(src);
    this.publishedUrls.push(source.download_url());
    return source.download_url();
  }

  async release(urls: string[]): Promise<void> {
    await this.getGftpServerInstance().release(urls);
  }
  async close() {
    if (this.publishedUrls.length) await this.getGftpServerInstance().release(this.publishedUrls);
    await this.getGftpServerInstance().done();
  }

  private async jsonrpc(method: string, params: object = {}) {
    if (!this.reader) {
      this.reader = this._readStream(this.process.stdout);
    }
    const paramsStr = JSON.stringify(params);
    const query = `{"jsonrpc": "2.0", "id": "1", "method": "${method}", "params": ${paramsStr}}\n`;
    let valueStr = "";
    await streamWrite(this.process.stdin, query);
    try {
      const { value } = await this.reader.next();
      valueStr = JSON.stringify(value);
      const { result } = JSON.parse(value as string);
      if (result === undefined) {
        throw value;
      }
      return result;
    } catch (error) {
      const msg = `gftp error. query: ${query} value: ${valueStr} error: ${JSON.stringify(error)}`;
      this.logger?.error(msg);
      throw Error(error);
    }
  }

  async *_readStream(readable) {
    for await (const line of chunksToLinesAsync(readable)) {
      yield chomp(line);
    }
  }
}
