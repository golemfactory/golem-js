import { Logger } from "./logger";
/**
 * Helper function implements simple logger prints all messages to console
 */
export function consoleLogger(): Logger {
  let level = "info";
  const print = (level: string, msg: unknown) => console.log(`${new Date().toISOString()} [${level}] ${msg}`);
  return {
    debug: (msg) => print("debug", msg),
    error: (msg) => print("error", msg),
    info: (msg) => print("info", msg),
    log: (msg: string) => print("log", msg),
    setLevel: (lvl: string) => (level = lvl),
    warn: (msg) => print("warn", msg),
    level,
  };
}
