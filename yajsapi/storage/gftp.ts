import { StorageProvider } from "./provider.js";
import { Logger, runtimeContextChecker } from "../utils/index.js";
import path from "path";
import fs from "fs";
import { chomp, chunksToLinesAsync, streamEnd, streamWrite } from "@rauschma/stringio";
import { spawn } from "child_process";

export class GftpStorageProvider implements StorageProvider {
  private gftpServerProcess;
  private reader;
  private publishedUrls: string[] = [];
  private isInitialized = false;

  constructor(private logger?: Logger) {
    if (runtimeContextChecker.isBrowser) {
      throw new Error(`File transfer by GFTP module is unsupported in the browser context.`);
    }
  }

  async init() {
    if (this.isInitialized) return;
    this.gftpServerProcess = await spawn("gftp server", [], { shell: true });
    this.gftpServerProcess.on("error", (error) => this.logger?.error(error));
    this.gftpServerProcess.stderr.on("error", (error) => this.logger?.error(error));
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

  async receive(path: string): Promise<string> {
    const { url } = await this.jsonrpc("receive", { output_file: path });
    return url;
  }

  async publish(src: string | Buffer): Promise<string> {
    if (typeof src !== "string" && !Buffer.isBuffer(src)) throw new Error("[StorageProvider] Unsupported source type");
    const url = typeof src === "string" ? await this.uploadFile(src) : await this.uploadBytes(src);
    this.publishedUrls.push(url);
    return url;
  }

  async release(urls: string[]): Promise<void> {
    return await this.jsonrpc("close", { urls });
  }

  async close() {
    if (this.publishedUrls.length) await this.release(this.publishedUrls);
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
      const { result } = JSON.parse(value as string);
      valueStr = value;
      if (result === undefined) throw value;
      return result;
    } catch (error) {
      const msg = `gftp error. query: ${query} value: ${valueStr} error: ${JSON.stringify(error)}`;
      this.logger?.error(msg);
      throw Error(error);
    }
  }

  async *readStream(readable) {
    for await (const line of chunksToLinesAsync(readable)) {
      yield chomp(line);
    }
  }

  private async uploadStream(stream: AsyncGenerator<Buffer>): Promise<string> {
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
