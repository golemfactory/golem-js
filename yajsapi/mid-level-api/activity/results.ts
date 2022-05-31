import * as stream from "stream";

export interface Result {
  index: number;
  eventDate: string;
  result: "Ok" | "Error";
  stdout?: string;
  stderr?: string;
  message?: string;
  isBatchFinished?: boolean;
}

export class Results<T = StreamResults | BatchResults> extends stream.Readable {}

export type StreamResults = { todo: true };
export type BatchResults = Array<Result>;
