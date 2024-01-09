export interface Logger {
  child(namespace: string): Logger;
  info(msg: string): void;
  info(msg: string, ctx: Record<string, unknown> | Error): void;
  error(msg: string): void;
  error(msg: string, ctx: Record<string, unknown> | Error): void;
}
