export interface Logger {
  child(namespace: string): Logger;
  debug(msg: string): void;
  debug(msg: string, ctx: Record<string, unknown> | Error): void;
  info(msg: string): void;
  info(msg: string, ctx: Record<string, unknown> | Error): void;
  warn(msg: string): void;
  warn(msg: string, ctx: Record<string, unknown> | Error): void;
  error(msg: string): void;
  error(msg: string, ctx: Record<string, unknown> | Error): void;
}
