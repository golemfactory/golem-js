import { ExeScriptCommandResultResultEnum } from "ya-ts-client/dist/ya-activity/src/models/exe-script-command-result";

export import ResultState = ExeScriptCommandResultResultEnum;
import { GolemInternalError } from "../error/golem-error";

// FIXME: Make the `data` field Uint8Array and update the rest of the code
// eslint-disable-next-line
export interface ResultData<T = any> {
  /** Index of script command */
  index: number;
  /** The datetime of the event on which the result was received */
  eventDate: string;
  /** If is success */
  result: ResultState;
  /** stdout of script command */
  stdout?: string | ArrayBuffer | null;
  /** stderr of script command */
  stderr?: string | ArrayBuffer | null;
  /** an error message if the result is not successful */
  message?: string | null;
  /** Is batch of already finished */
  isBatchFinished?: boolean;

  /** In case the command was related to upload or download, this will contain the transferred data */
  data?: T;
}

// FIXME: Make the `data` field Uint8Array and update the rest of the code
// eslint-disable-next-line
export class Result<TData = any> implements ResultData<TData> {
  index: number;
  eventDate: string;
  result: ResultState;
  stdout?: string | ArrayBuffer | null;
  stderr?: string | ArrayBuffer | null;
  message?: string | null;
  isBatchFinished?: boolean;
  data?: TData;

  constructor(props: ResultData) {
    this.index = props.index;
    this.eventDate = props.eventDate;
    this.result = props.result;
    this.stdout = props.stdout;
    this.stderr = props.stderr;
    this.message = props.message;
    this.isBatchFinished = props.isBatchFinished;
    this.data = props.data;
  }

  /**
   * Helper method making JSON-like output results more accessible
   */
  public getOutputAsJson<Output = object>(): Output {
    if (!this.stdout) {
      throw new GolemInternalError("Can't convert Result output to JSON, because the output is missing!");
    }

    try {
      return JSON.parse(this.stdout.toString().trim());
    } catch (err) {
      throw new GolemInternalError(
        `Failed to parse output to JSON! Output: "${this.stdout.toString()}". Error: ${err}`,
      );
    }
  }
}

export interface StreamingBatchEvent {
  // Reason for disable: That's something what yagna returns from its api
  // eslint-disable-next-line @typescript-eslint/naming-convention
  batch_id: string;
  index: number;
  timestamp: string;
  kind: RuntimeEventKind;
}

export interface RuntimeEventKind {
  started?: RuntimeEventStarted;
  stdout?: string | ArrayBuffer;
  stderr?: string | ArrayBuffer;
  finished?: RuntimeEventFinished;
}

interface RuntimeEventStarted {
  command: object;
}

interface RuntimeEventFinished {
  // Reason for disable: That's something what yagna returns from its api
  // eslint-disable-next-line @typescript-eslint/naming-convention
  return_code: number;
  message: string;
}
