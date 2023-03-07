import { ExeScriptRequest } from "ya-ts-client/dist/ya-activity/src/models/index.js";
import { StorageProvider } from "../storage/index.js";

/**
 * @category Mid-level
 */
export class Command {
  protected args: object;
  constructor(private commandName: string, args?: object) {
    this.args = args || {};
  }
  toJson() {
    return {
      [this.commandName]: this.args,
    };
  }
  toExeScriptRequest(): ExeScriptRequest {
    return { text: JSON.stringify([this.toJson()]) };
  }
  async before() {
    // abstract
  }
  async after() {
    // abstract
  }
}

/**
 * @category Mid-level
 */
export class Deploy extends Command {
  constructor(args?: object) {
    super("deploy", args);
  }
}

/**
 * @category Mid-level
 */
export class Start extends Command {
  constructor(args?: object) {
    super("start", args);
  }
}

export type Capture = {
  stdout?: CaptureMode;
  stderr?: CaptureMode;
};
type CaptureMode =
  | { atEnd: { part?: CapturePart; format?: CaptureFormat } }
  | { stream: { limit?: number; format?: CaptureFormat } };
type CapturePart = { head: number } | { tail: number } | { headTail: number };

type CaptureFormat = "string" | "binary";

/**
 * @category Mid-level
 */
export class Run extends Command {
  constructor(cmd: string, args?: string[] | null, env?: object | null, capture?: Capture) {
    const captureOpt = capture || {
      stdout: { atEnd: { format: "string" } },
      stderr: { atEnd: { format: "string" } },
    };
    super("run", {
      entry_point: cmd,
      args,
      env,
      capture: captureOpt,
    });
  }
}
export class Terminate extends Command {
  constructor(args?: object) {
    super("terminate", args);
  }
}

/**
 * @category Mid-level
 */
export class Transfer extends Command {
  constructor(protected from?: string, protected to?: string, args?: object) {
    super("transfer", { from, to, args });
  }
}

/**
 * @category Mid-level
 */
export class UploadFile extends Transfer {
  constructor(private storageProvider: StorageProvider, private src: string | Buffer, private dstPath: string) {
    super();
    this.args["to"] = `container:${dstPath}`;
  }
  async before() {
    this.args["from"] = await this.storageProvider.publish(this.src);
  }
  async after() {
    await this.storageProvider.release([this.args["from"]]);
  }
}

/**
 * @category Mid-level
 */
export class DownloadFile extends Transfer {
  constructor(private storageProvider: StorageProvider, private srcPath: string, private dstPath: string) {
    super();
    this.args = { from: `container:${srcPath}` };
  }
  async before() {
    this.args["to"] = await this.storageProvider.receive(this.dstPath);
  }
}
