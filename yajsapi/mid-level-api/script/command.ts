import { ExeScriptRequest } from "ya-ts-client/dist/ya-activity/src/models";
import { StorageProvider } from "../storage/provider";

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

export class Deploy extends Command {
  constructor(args?: object) {
    super("deploy", args);
  }
}
export class Start extends Command {
  constructor(args?: object) {
    super("start", args);
  }
}

export type Capture = {
  stdout: { [key in CaptureMode]?: { format: `${CaptureFormat}` } };
  stderr: { [key in CaptureMode]?: { format: `${CaptureFormat}` } };
};

export enum CaptureMode {
  AT_END = "atEnd",
  STREAM = "stream",
}

export enum CaptureFormat {
  BIN = "bin",
  STR = "str",
}

export class Run extends Command {
  constructor(cmd: string, args?: string[] | null, env?: object | null, capture?: Capture) {
    const captureOpt = capture || {
      stdout: { [CaptureMode.AT_END]: { format: CaptureFormat.STR } },
      stderr: { [CaptureMode.AT_END]: { format: CaptureFormat.STR } },
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

export class Transfer extends Command {
  constructor(protected from?: string, protected to?: string, args?: object) {
    super("transfer", { from, to, args });
  }
}

export class SendFile extends Transfer {
  constructor(private storageProvider: StorageProvider, private srcPath: string, private dstPath: string) {
    super();
    this.args["to"] = `container:${dstPath}`;
  }
  async before() {
    this.args["from"] = await this.storageProvider.upload(this.srcPath);
  }
}

export class DownloadFile extends Transfer {
  constructor(private storageProvider: StorageProvider, private srcPath: string, private dstPath: string) {
    super();
    this.args = { from: `container:${srcPath}` };
  }
  async before() {
    this.args["to"] = await this.storageProvider.download(this.dstPath);
  }
}
