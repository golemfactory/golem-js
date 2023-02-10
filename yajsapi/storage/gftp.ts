import { StorageProvider } from "./provider.js";
import { Logger, runtimeContextChecker } from "../utils/index.js";
import path from "path";
import fs from "fs";

/**
 * GFTP Storage Provide
 *
 * @description
 */
export class GftpStorageProvider implements StorageProvider {
  private gftpServerProcess;
  private publishedUrls: string[] = [];

  constructor(private logger?: Logger) {
    if (runtimeContextChecker.isBrowser) {
      throw new Error(`File transfer by GFTP module is unsupported in the browser context.`);
    }
  }

  async init() {
    const { spawn } = await import("child_process");
    this.gftpServerProcess = await spawn("gftp server", [], { shell: true });
    this.gftpServerProcess.stdin.setEncoding("utf-8");
    this.gftpServerProcess.stdout.setEncoding("utf-8");
    this.gftpServerProcess.on("error", (error) => this.logger?.error(error));
    this.gftpServerProcess.stderr.on("error", (error) => this.logger?.error(error));
    this.gftpServerProcess.stdout.on("error", (error) => this.logger?.error(error));
    this.logger?.info(`GFTP Version: ${await this.jsonRpc("version")}`);
  }

  private async generateTempFileName(): Promise<string> {
    const { randomUUID } = await import("crypto");
    const tmp = await import("tmp/lib/tmp.js");
    const file_name = path.join(tmp.dirSync().name, randomUUID().toString());
    if (fs.existsSync(file_name)) fs.unlinkSync(file_name);
    return file_name;
  }

  async receive(path: string): Promise<string> {
    const { url } = await this.jsonRpc<{ url: string }>("receive", { output_file: path });
    return url;
  }

  async publish(src: string | Buffer): Promise<string> {
    if (typeof src !== "string" && !Buffer.isBuffer(src)) throw new Error("[StorageProvider] Unsupported source type");
    const url = typeof src === "string" ? await this.uploadFile(src) : await this.uploadBytes(src);
    this.publishedUrls.push(url);
    return url;
  }

  async release(urls: string[]): Promise<void> {
    return await this.jsonRpc("close", { urls });
  }

  async close() {
    if (this.publishedUrls.length) await this.release(this.publishedUrls);
    this.gftpServerProcess?.kill();
  }

  private async jsonRpc<T = object>(method: string, params: object = {}): Promise<T> {
    const paramsStr = JSON.stringify(params);
    const query = `{"jsonrpc": "2.0", "id": "1", "method": "${method}", "params": ${paramsStr}}\n`;
    this.gftpServerProcess.stdin.write(query);
    return new Promise((res, rej) =>
      this.gftpServerProcess.stdout.on("data", (data) => {
        try {
          res(JSON.parse(data)?.result);
        } catch (e) {
          rej("[GFTP] JsonRpc Error: " + e);
        }
      })
    );
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
    const links = await this.jsonRpc<{ url: string }[]>("publish", { files: [file_name.toString()] });
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
    const links = await this.jsonRpc("publish", { files: [file.toString()] });
    if (!links || !links?.[0].url) throw new Error(`[Gftp] Unable to upload file ${file}`);
    return links[0].url;
  }
}
