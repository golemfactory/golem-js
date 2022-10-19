import winston from "winston";
import { Logger } from "./logger";
import path from "path";
import dayjs from "dayjs";

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

export const winstonLogger: Logger = {
  ...logger,
  setLevel: (level: string) => {
    options.level = level;
    options.transports = [
      new winston.transports.Console({ level: level }),
      new winston.transports.File({
        filename: path.join("logs", `yajsapi-${dayjs().format("YYYY-MM-DD_HH-mm-ss")}.log`),
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
