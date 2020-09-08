import exitHook from "async-exit-hook";

import process from "process";
import { spawn, ChildProcess } from "child_process";
import { StorageProvider, Destination, Source, Content } from ".";

const { promises: fs } = require("fs");
const path = require("path");
const { v4: uuid } = require("uuid");
const tmp = require("tmp");

class PubLink {
  //"""GFTP linking information."""

  public file!: string;
  //"""file on local filesystem."""

  public url!: string;
  //"""GFTP url as which local files is exposed."""
}

let CommandStatus: string;

class GftpDriver {
  //Protocol
  //"""Golem FTP service API.

  async version(): Promise<string> {
    //"""Gets driver version."""
    return "";
  }

  async publish(files: string[]): Promise<PubLink[]> {
    /*Exposes local file as GFTP url.

        `files`
        :   local files to be exposed

        */
    return [];
  }

  // async close(urls: string[]): Promise<CommandStatus> {
  //     //"""Stops exposing GFTP urls created by [publish(files=[..])](#publish)."""
  //     pass
  // }

  async receive(output_file: string): Promise<PubLink> {
    /*Creates GFTP url for receiving file.

         :  `output_file` -
         */
    return new PubLink();
  }

  // async upload(file: string, url: string) {
  //     pass
  // }

  // async shutdown(): Promise<CommandStatus> {
  //     /*Stops GFTP service.

  //      After shutdown all generated urls will be unavailable.
  //     */
  //     pass
  // }
}

function service(debug = false) {
  let proc = new _Process(debug);
  return proc;
}

class _Process {
  _debug;
  _proc?;

  constructor(_debug: boolean = false) {
    this._debug = _debug;
    this._proc = null;
  }

  // async ready(): Promise<GftpDriver> {
  //     let env = this._debug ? { ...process.env, RUST_LOG: "debug" } : null
  //     this._proc = await spawn("gftp server", [],
  //         {
  //             shell: true,
  //             env: env,
  //             stdio: [process.stdin, process.stdout, process.stderr]
  //          })
  //     return this
  // }

  // async done(exc_type, exc_val, exc_tb) {
  //     // with contextlib.suppress(Exception):
  //         await this._close()
  // }

  // async _close() {
  //     if (!this._proc)
  //         return
  //     let p: ChildProcess = this._proc
  //     this._proc = null

  //     // with contextlib.suppress(Exception):
  //         await (this as GftpDriver).shutdown()

  //     if (p.stdin)
  //         await p.stdin.drain()
  //         p.stdin.close()
  //         try {
  //             await asyncio.wait_for(p.wait(), 10.0)
  //             return
  //         } catch(err: asyncio.TimeoutError){}
  //     p.kill()
  //     let ret_code = await p.wait()
  //     _logger.debug("GFTP server closed, code=%d", ret_code)
  // }

  _log_debug(msg_dir: string, msg: string | Buffer) {
    if (this._debug) {
      if (msg instanceof Buffer) msg = msg.toString("utf-8");
      let stderr = process.stderr;
      stderr.write(msg_dir == "in" ? "\n <= " : "\n => ");
      stderr.write(msg);
    }
  }

  async send_message(message) {
    if (!this._proc) return;
    if (!this._proc.stdin) return;
    if (!this._proc.stdout) return;
    let _message = message.serialize() + "\n";
    let buffer = Buffer.from(_message, "utf-8");
    this._log_debug("out", _message);
    this._proc.stdin.write(buffer);
    await this._proc.stdin.drain();
    let msg = await this._proc.stdout.readline();
    this._log_debug("in", msg);
    msg = JSON.parse(msg);
    return message.parse_response(msg);
  }
}

function* _temp_file(temp_dir: string): Generator<string> {
  let file_name = path.join(temp_dir, uuid().toString());
  yield file_name;
  if (fs.existsSync(file_name)) fs.unlinkSync(file_name);
}

class GftpSource extends Source {
  private _len;
  private _link;
  constructor(length: number, link: PubLink) {
    super();
    this._len = length;
    this._link = link;
  }

  download_url(): string {
    return this._link["url"];
  }

  async content_length(): Promise<number> {
    return this._len;
  }
}

class GftpDestination extends Destination {
  private _proc;
  private _link;
  constructor(_proc: GftpDriver, _link: PubLink) {
    super();
    this._proc = _proc;
    this._link = _link;
  }

  upload_url(): string {
    return this._link["url"];
  }

  async download_stream(): Promise<Content> {
    let file_path = this._link["file"];
    let length = fs.statSync(file_path)["size"];

    async function* chunks(): AsyncGenerator<Buffer> {
      const stream = fs.createReadStream(file_path, {
        highWaterMark: 30000,
        encoding: "utf8",
      });
      for (let chunk of stream) yield chunk;
    }

    return new Content(length, chunks());
  }

  async download_file(destination_file: string) {
    if (destination_file.toString() == this._link["file"]) return;
    return await super.download_file(destination_file);
  }
}

class GftpProvider implements StorageProvider {
  _temp_dir?: string | null;
  __exit_stack;
  _process;

  constructor(tmpdir: string | null = null) {
    // this.__exit_stack = new AsyncExitStack()
    this._temp_dir = tmpdir || null;
    this._process = null;
    exitHook(async (callback) => {
      await this.done();
      callback();
    });
  }
  upload_bytes(data: Buffer): Promise<Source> {
    throw new Error("Method not implemented.");
  }

  async ready(): Promise<StorageProvider> {
    this._temp_dir = tmp.dirSync();
    // let _process = await this.__get_process()
    // let _ver = await _process.version()
    //# TODO check version
    // if(!_ver) throw ""
    return this as StorageProvider;
  }

  async done(
  ): Promise<boolean | null | void> {
    await this.__exit_stack.aclose();
    return null;
  }

  __new_file(): string {
    let temp_dir: string =
      this._temp_dir || this.__exit_stack.enter_context(tmp.dirSync());
    if (!this._temp_dir) this._temp_dir = temp_dir;
    return this.__exit_stack.enter_context(_temp_file(temp_dir));
  }

  async __get_process(): Promise<GftpDriver> {
    let _debug = !!process.env["DEBUG_GFTP"];
    let _process =
      this._process ||
      (await this.__exit_stack.enter_async_context(service(_debug)));
    if (!this._process) this._process = _process;
    return _process;
  }

  async upload_stream(
    length: number,
    stream: AsyncGenerator<Buffer>
  ): Promise<Source> {
    let file_name = this.__new_file();
    let wStream = fs.writeableStream(file_name);
    for await (let chunk of stream) {
      wStream.write(chunk);
    }
    let _process = await this.__get_process();
    let links = await _process.publish([file_name.toString()]);
    if (links.length !== 1) throw "invalid gftp publish response";
    let link = links[0];
    return new GftpSource(length, link);
  }

  async upload_file(_path: string): Promise<Source> {
    let _process = await this.__get_process();
    let links = await _process.publish([_path.toString()]);
    let length = fs.statSync(_path)["size"];
    if (links.length !== 1) throw "invalid gftp publish response";
    return new GftpSource(length, links[0]);
  }

  async new_destination(
    destination_file: string | null = null
  ): Promise<Destination> {
    if (destination_file) {
      if (fs.existsSync(destination_file)) {
        destination_file = null;
      }
    }
    let output_file = destination_file
      ? destination_file!.toString()
      : this.__new_file();
    let _process = await this.__get_process();
    let link = await _process.receive((output_file = output_file));
    return new GftpDestination(_process, link);
  }
}

export function provider(): any {
  return new GftpProvider();
}
