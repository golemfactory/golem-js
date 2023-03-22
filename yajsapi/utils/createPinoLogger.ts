import { Logger, LogLevel } from "./logger.js";
import { DestinationStream, LoggerOptions, pino } from "pino";

export function createPinoLogger(optionsOrStream?: LoggerOptions | DestinationStream): Logger {
  const logger = pino(optionsOrStream);
  return {
    level: logger.level as LogLevel,
    debug: (msg) => logger.debug(msg),
    info: (msg) => logger.info(msg),
    log: (msg) => logger.info(msg),
    warn: (msg) => logger.warn(msg),
    error: (msg) => logger.error(msg),
    table: (object) => console.table(object),
    setLevel: function (level: string) {
      logger.level = level;
      this.level = level as LogLevel;
    },
  };
}