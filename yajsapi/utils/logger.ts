export declare enum LogLevel {
  debug = "debug",
  info = "info",
  warn = "warn",
  error = "error",
}
export interface Logger {
  level: string;
  setLevel(level: string);
  log(msg);
  info(msg);
  warn(msg);
  error(msg);
  debug(msg);
  table?(object);
}
