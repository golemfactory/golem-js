export interface Result {
  /** Index of result activity */
  index: number;
  /** Event date */
  eventDate: string;
  /** If is success */
  result?: "Ok" | "Error";
  /** process stdout */
  stdout?: string;
  /** process stderr */
  stderr?: string;
  /** result message */
  message?: string;
  /** Is batch of already finished */
  isBatchFinished?: boolean;
}

export interface StreamingBatchEvent {
  batch_id: string;
  index: number;
  timestamp: string;
  kind: RuntimeEventKind;
}

interface RuntimeEventKind {
  started?: RuntimeEventStarted;
  stdout?: string | ArrayBuffer;
  stderr?: string | ArrayBuffer;
  finished?: RuntimeEventFinished;
}

interface RuntimeEventStarted {
  command: object;
}

interface RuntimeEventFinished {
  return_code: number;
  message: string;
}
