import { StorageProvider } from "./provider";
import { runtimeContextChecker } from "../utils";
import { v4 as uuid } from "uuid";
import path from "path";
import fs from "fs";
import tmp from "tmp";
import { chomp, chunksToLinesAsync, streamEnd, streamWrite } from "@rauschma/stringio";
import { spawn } from "child_process";

const TMP_DIR = tmp.dirSync().name;

export class GftpStorageProvider implements StorageProvider {
  private gftpServerProcess;
  private reader;
  private logger;
  private publishedUrls: string[] = [];

  // Todo check if the param in constructor is needed
  constructor(prov?) {
    if (runtimeContextChecker.isBrowser) {
      throw new Error(`File transfer by GFTP module is unsupported in the browser context.`);
    }
  }

  async init() {
    this.gftpServerProcess = await spawn("gftp server", [], {
      shell: true,
      //env: env,
    });
  }

  isInitiated() {
    return !!this.gftpServerProcess;
  }

  private generateTempFileName(): string {
    const file_name = path.join(TMP_DIR, uuid().toString());
    if (fs.existsSync(file_name)) fs.unlinkSync(file_name);
    return file_name;
  }

  private getGftpServerProcess() {
    // TODO check if process is running
    return this.gftpServerProcess;
  }

  async receive(path: string): Promise<string> {
    const { url } = await this.jsonrpc("receive", { output_file: path });
    return url;
  }

  async publish(src: string | Buffer): Promise<string> {
    if (typeof src !== "string" && !Buffer.isBuffer(src)) throw new Error("[StorageProvider] Unsupported source type");
    const url = typeof src === "string" ? await this.upload_file(src) : await this.upload_bytes(src);
    this.publishedUrls.push(url);
    return url;
  }

  async release(urls: string[]): Promise<void> {
    return await this.jsonrpc("close", { urls });
  }

  async close() {
    if (this.publishedUrls.length) await this.release(this.publishedUrls);
    await streamEnd(this.getGftpServerProcess().stdin);
  }

  private async jsonrpc(method: string, params: object = {}) {
    if (!this.isInitiated()) {
      await this.init();
    }
    if (!this.reader) {
      this.reader = this._readStream(this.getGftpServerProcess().stdout);
    }
    const paramsStr = JSON.stringify(params);
    const query = `{"jsonrpc": "2.0", "id": "1", "method": "${method}", "params": ${paramsStr}}\n`;
    let valueStr = "";
    await streamWrite(this.getGftpServerProcess().stdin, query);
    try {
      const { value } = await this.reader.next();
      const { result } = JSON.parse(value as string);
      valueStr = value;
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

  private async upload_stream(stream: AsyncGenerator<Buffer>): Promise<string> {
    const file_name = this.generateTempFileName();
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

  private async upload_bytes(data: Buffer): Promise<string> {
    async function* _inner() {
      yield data;
    }

    return await this.upload_stream(_inner());
  }

  private async upload_file(file: string): Promise<string> {
    const links = await this.jsonrpc("publish", { files: [file.toString()] });
    return links[0]?.url;
  }
}
