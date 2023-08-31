export enum LogLevel {
  Debug = "debug",
  Info = "info",
  Warn = "warn",
  Error = "error",
  Log = "log",
}
export interface Logger {
  level: string;
  setLevel(level: string);
  log(msg);
  info(msg);
  warn(msg);
  error(msg);
  debug(msg);

  /**
   * Produce a table representation of the supplied data.
   * This is currently used to display cost summary.
   * @param object
   */
  table?(object);
}
