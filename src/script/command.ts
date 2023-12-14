import { ExeScriptRequest } from "ya-ts-client/dist/ya-activity/src/models";
import { StorageProvider } from "../storage";
import { Result, ResultState } from "../activity";

const EmptyErrorResult = new Result({
  result: ResultState.Error,
  eventDate: new Date().toISOString(),
  index: -1,
  message: "No result due to error",
});

/**
 * @hidden
 */
export class Command<T = unknown> {
  protected args: Record<string, unknown>;

  constructor(
    private commandName: string,
    args?: Record<string, unknown>,
  ) {
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
  async after(result?: Result<T>): Promise<Result<T>> {
    return result ?? EmptyErrorResult;
  }
}

/**
 * @hidden
 */
export class Deploy extends Command {
  constructor(args?: Record<string, unknown>) {
    super("deploy", args);
  }
}

/**
 * @hidden
 */
export class Start extends Command {
  constructor(args?: Record<string, unknown>) {
    super("start", args);
  }
}

export type Capture = {
  stdout?: CaptureMode;
  stderr?: CaptureMode;
};
export type CaptureMode =
  | { atEnd: { part?: CapturePart; format?: CaptureFormat } }
  | { stream: { limit?: number; format?: CaptureFormat } };
type CapturePart = { head: number } | { tail: number } | { headTail: number };

type CaptureFormat = "string" | "binary";

/**
 * @hidden
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
  constructor(args?: Record<string, unknown>) {
    super("terminate", args);
  }
}

/**
 * @hidden
 */
export class Transfer<T = unknown> extends Command<T> {
  constructor(
    protected from?: string,
    protected to?: string,
    args?: object,
  ) {
    super("transfer", { from, to, args });
  }
}

/**
 * @hidden
 */
export class UploadFile extends Transfer {
  constructor(
    private storageProvider: StorageProvider,
    private src: string,
    private dstPath: string,
  ) {
    super();
    this.args["to"] = `container:${dstPath}`;
  }

  async before() {
    this.args["from"] = await this.storageProvider.publishFile(this.src);
  }

  async after(result: Result): Promise<Result> {
    await this.storageProvider.release([this.args["from"] as string]);
    return result;
  }
}

/**
 * @category Mid-level
 */
export class UploadData extends Transfer {
  constructor(
    private storageProvider: StorageProvider,
    private src: Uint8Array,
    private dstPath: string,
  ) {
    super();
    this.args["to"] = `container:${dstPath}`;
  }

  async before() {
    this.args["from"] = await this.storageProvider.publishData(this.src);
  }

  async after(result: Result): Promise<Result> {
    await this.storageProvider.release([this.args["from"] as string]);
    return result;
  }
}

/**
 * @hidden
 */
export class DownloadFile extends Transfer {
  constructor(
    private storageProvider: StorageProvider,
    private srcPath: string,
    private dstPath: string,
  ) {
    super();
    this.args = { from: `container:${srcPath}` };
  }

  async before() {
    this.args["to"] = await this.storageProvider.receiveFile(this.dstPath);
  }

  async after(result: Result): Promise<Result> {
    await this.storageProvider.release([this.args["to"] as string]);
    return result;
  }
}

/**
 * @category Mid-level
 */
export class DownloadData extends Transfer<Uint8Array> {
  private chunks: Uint8Array[] = [];

  constructor(
    private storageProvider: StorageProvider,
    private srcPath: string,
  ) {
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
    await this.storageProvider.release([this.args["to"] as string]);
    if (result.result === ResultState.Ok) {
      return new Result<Uint8Array>({
        ...result,
        data: this.combineChunks(),
      });
    }

    return new Result<Uint8Array>({
      ...result,
      result: ResultState.Error,
      data: undefined,
    });
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
