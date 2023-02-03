import { Logger } from "./logger";

/**
 * Helper class implements simple logger prints all messages to console
 */
export class ConsoleLogger implements Logger {
  level = "debug";

  debug(msg) {
    this.print("debug", msg);
  }

  error(msg) {
    this.print("error", msg);
  }

  info(msg) {
    this.print("info", msg);
  }

  log(msg: string) {
    this.print("log", msg);
  }

  setLevel(level: string) {
    this.level = level;
  }

  warn(msg) {
    this.print("warn", msg);
  }

  table(obj) {
    console.table(obj);
  }

  private print(level, msg) {
    console.log(`${new Date().toISOString()} [${level}] ${msg}`);
  }
}
