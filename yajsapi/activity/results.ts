export interface Result {
  index: number;
  eventDate: string;
  result?: "Ok" | "Error";
  stdout?: string;
  stderr?: string;
  message?: string;
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
