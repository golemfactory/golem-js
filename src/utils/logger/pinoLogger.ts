import { Logger, LogLevel } from "./logger";
import * as pino from "pino";

export function pinoLogger(optionsOrStream?: pino.LoggerOptions | pino.DestinationStream): Logger {
  const logger = pino.pino(optionsOrStream);
  return {
    level: logger.level as LogLevel,
    debug: (msg) => logger.debug(msg),
    info: (msg) => logger.info(msg),
    log: (msg) => logger.info(msg),
    warn: (msg) => logger.warn(msg),
    error: (msg) => logger.error(msg),
    setLevel: function (level: string) {
      logger.level = level;
      this.level = level as LogLevel;
    },
  };
}
