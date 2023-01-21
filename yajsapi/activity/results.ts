/**
 * @category Mid-level
 */
export interface Result {
  /** Index of script command */
  index: number;
  /** The datetime of the event on which the result was received */
  eventDate: string;
  /** If is success */
  result?: "Ok" | "Error";
  /** stdout of script command */
  stdout?: string;
  /** stderr of script command */
  stderr?: string;
  /** an error message if the result is not successful */
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
