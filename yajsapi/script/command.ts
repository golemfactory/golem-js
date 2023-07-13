import { ExeScriptRequest } from "ya-ts-client/dist/ya-activity/src/models/index.js";
import { StorageProvider } from "../storage/index.js";
import { Result, ResultState } from "../activity/index.js";

const EmptyErrorResult: Result = {
  result: ResultState.ERROR,
  eventDate: new Date().toISOString(),
  index: -1,
  message: "No result due to error",
};

/**
 * @category Mid-level
 */
export class Command<T = unknown> {
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

  /**
   * Setup local environment for executing this command.
   */
  async before() {
    // abstract
  }

  /**
   * Cleanup local setup that was needed for the command to run.
   *
   * It is called after the command was sent to the activity, and the command was processed.
   *
   * When run within scripts or batch commands, after() might be called without any results, as one of the previous
   * commands might have failed. In this case, the command should still cleanup its local setup and return an empty
   * error result.
   *
   * @param result
   */
  async after(result?: Result): Promise<Result<T>> {
    return (result ?? EmptyErrorResult) as Result<T>;
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
export class Transfer<T = unknown> extends Command<T> {
  constructor(protected from?: string, protected to?: string, args?: object) {
    super("transfer", { from, to, args });
  }
}

/**
 * @category Mid-level
 */
export class UploadFile extends Transfer {
  constructor(private storageProvider: StorageProvider, private src: string, private dstPath: string) {
    super();
    this.args["to"] = `container:${dstPath}`;
  }

  async before() {
    this.args["from"] = await this.storageProvider.publishFile(this.src);
  }

  async after(result: Result): Promise<Result> {
    await this.storageProvider.release([this.args["from"]]);
    return result;
  }
}

/**
 * @category Mid-level
 */
export class UploadData extends Transfer {
  constructor(private storageProvider: StorageProvider, private src: Uint8Array, private dstPath: string) {
    super();
    this.args["to"] = `container:${dstPath}`;
  }

  async before() {
    this.args["from"] = await this.storageProvider.publishData(this.src);
  }

  async after(result: Result): Promise<Result> {
    await this.storageProvider.release([this.args["from"]]);
    return result;
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
    this.args["to"] = await this.storageProvider.receiveFile(this.dstPath);
  }

  async after(result: Result): Promise<Result> {
    await this.storageProvider.release([this.args["to"]]);
    return result;
  }
}

/**
 * @category Mid-level
 */
export class DownloadData extends Transfer<Uint8Array> {
  private chunks: Uint8Array[] = [];

  constructor(private storageProvider: StorageProvider, private srcPath: string) {
    super();
    this.args = { from: `container:${srcPath}` };
  }

  async before() {
    this.args["to"] = await this.storageProvider.receiveData((data) => {
      // NOTE: this assumes in-order delivery. For not it should work with websocket provider and local file polyfill.
      this.chunks.push(data);
    });
  }

  async after(result: Result): Promise<Result<Uint8Array>> {
    await this.storageProvider.release([this.args["to"]]);
    if (result.result === ResultState.OK) {
      return {
        ...result,
        data: this.combineChunks(),
      };
    }

    return {
      ...result,
      result: ResultState.ERROR,
      data: undefined,
    };
  }

  private combineChunks(): Uint8Array {
    const data = new Uint8Array(this.chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of this.chunks) {
      data.set(chunk, offset);
      offset += chunk.length;
    }

    // Release memory.
    this.chunks = [];

    return data;
  }
}
