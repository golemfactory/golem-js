export interface LoggerOptions {
  // TODO
}

export class Logger {
  constructor(options?: LoggerOptions) {}
  debug(msg: string): void {}
  error(msg: string): void {}
  log(msg: string): void {}
  warn(msg: string): void {}
}
