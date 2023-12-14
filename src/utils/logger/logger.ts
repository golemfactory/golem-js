export enum LogLevel {
  Debug = "debug",
  Info = "info",
  Warn = "warn",
  Error = "error",
  Log = "log",
}
export interface Logger {
  level: string;
  setLevel(level: string): void;
  log(msg: unknown): void;
  info(msg: unknown): void;
  warn(msg: unknown): void;
  error(msg: unknown): void;
  debug(msg: unknown): void;
}
