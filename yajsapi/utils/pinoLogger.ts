import { pino } from "pino";
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
