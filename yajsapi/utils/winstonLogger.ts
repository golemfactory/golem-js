import winston from "winston";
import { Logger } from "./logger.js";
import path from "path";

const { colorize, combine, timestamp, label, printf } = winston.format;
const customFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

const options = {
  level: "info",
  format: combine(
    colorize(),
    label({ label: "yajsapi" }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSSZ" }),
    customFormat
  ),
  defaultMeta: { service: "user-service" },
  transports: [new winston.transports.Console()],
};
const logColors = {
  info: "blue",
  debug: "magenta",
  warn: "yellow",
  error: "red",
};
winston.addColors(logColors);

const logger = winston.createLogger(options);
let logLevel;
/**
 *
 * @ignore
 */
export const winstonLogger: Logger = {
  level: logLevel,
  debug: (msg) => logger.debug(msg),
  info: (msg) => logger.info(msg),
  log: (msg) => logger.log(msg),
  warn: (msg) => logger.warn(msg),
  error: (msg) => logger.error(msg),
  table: (object) => console.table(object),
  setLevel: (level: string) => {
    logLevel = level;
    options.level = level;
    options.transports = [
      new winston.transports.Console({ level: level }),
      new winston.transports.File({
        filename: path.join("logs", `yajsapi-${new Date().toISOString()}.log`),
        level: "silly",
      }) as any,
      new winston.transports.File({
        filename: path.join("logs", "yajsapi-current.log"),
        level: "silly",
        options: { flags: "w" },
      }) as any,
    ];
    logger.configure(options);
  },
};
