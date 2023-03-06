import { pino } from "pino";
import PinoPretty from "pino-pretty";
import { Logger } from "./logger.js";
import path from "path";

const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
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
