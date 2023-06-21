import { pino, LoggerOptions } from "pino";
import { Logger } from "./logger.js";

const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      ignore: "pid,hostname",
    },
  },
});
let logLevel;
/**
 *
 * @ignore
 */
export const pinoLogger: Logger = {
  level: logLevel,
  debug: (msg) => logger.debug(msg),
  info: (msg) => logger.info(msg),
  log: (msg) => logger.info(msg),
  warn: (msg) => logger.warn(msg),
  error: (msg) => logger.error(msg),
  table: (object) => console.table(object),
  setLevel: (level: string) => {
    logger.level = level;
  },
};

//  I left this here as I use it during development to avoid global logger
// ? Isnt it better general approach ?

export function pinoLoggerFactory<Options extends LoggerOptions>({
  level,
  pinoOptions,
}: {
  level: pino.Level;
  pinoOptions: Options;
}): Logger {
  const logger = pino({
    ...pinoOptions,
    ...{
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          ignore: "pid,hostname",
        },
      },
    },
  });
  return {
    level,
    debug: (msg) => logger.debug(msg),
    info: (msg) => logger.info(msg),
    log: (msg) => logger.info(msg),
    warn: (msg) => logger.warn(msg),
    error: (msg) => logger.error(msg),
    table: (object) => console.table(object),
    setLevel: (level: string) => {
      logger.level = level;
    },
  };
}
