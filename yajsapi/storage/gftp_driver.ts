import { Logger } from "../utils";
import { chomp, chunksToLinesAsync, streamEnd, streamWrite } from "@rauschma/stringio";
import { spawn, ChildProcess } from "child_process";

export class GftpDriver {
  private process;
  private reader;

  constructor(private logger?: Logger) {}
  //Protocol
  //"""Golem FTP service API.

  async init() {
    this.process = await spawn("gftp server", [], {
      shell: true,
      //env: env,
    });
  }

  isInitiated() {
    return !!this.process;
  }

  async version(): Promise<any> {
    //"""Gets driver version."""
    return await this._jsonrpc("version");
  }

  async publish(files: string[]): Promise<any> {
    /*Exposes local file as GFTP url.
        `files`
        :   local files to be exposed
        */
    return await this._jsonrpc("publish", { files });
  }

  // async close(urls: string[]): Promise<CommandStatus> {
  //     //"""Stops exposing GFTP urls created by [publish(files=[..])](#publish)."""
  //     pass
  // }

  async receive(output_file: string): Promise<any> {
    /*Creates GFTP url for receiving file.
        :  `output_file` -
        */
    return await this._jsonrpc("receive", { output_file });
  }

  async close(urls: string[]): Promise<any> {
    /*
     * Stops exposing GFTP urls created by publish(files)
     */
    return await this._jsonrpc("close", { urls });
  }

  // async upload(file: string, url: string) {
  //     pass
  // }

  async shutdown(): Promise<any> {
    /*Stops GFTP service.
          After shutdown all generated urls will be unavailable.
        */
    if (!this.isInitiated()) {
      await this.init();
    }

    // await this._jsonrpc("shutdown");
    await streamEnd(this.process.stdin);
  }

  async _jsonrpc(method: string, params: object = {}) {
    if (!this.isInitiated()) {
      await this.init();
    }
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
