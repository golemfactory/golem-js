export interface Logger {
  level: string;
  setLevel(level: string);
  log(msg);
  info(msg);
  warn(msg);
  error(msg);
  debug(msg);
}
