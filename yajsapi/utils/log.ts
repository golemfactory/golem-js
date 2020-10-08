import winston from "winston";
import { commander } from "./";

const { colorize, combine, timestamp, label, printf } = winston.format;
const customFormat = printf(({ level, message, label, timestamp }) => {
    return `${timestamp} [${label}] ${level}: ${message}`;
  });

const options = {
    level: commander.debug ? 'debug' : 'info',
    format: combine(
        colorize(),
        label({ label: 'yajsapi' }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
      ),
    defaultMeta: { service: 'user-service' },
    transports: [
      //
      // - Write all logs with level `error` and below to `error.log`
      // - Write all logs with level `info` and below to `combined.log`
      //
    //   new winston.transports.File({ filename: 'error.log', level: 'error' }),
    //   new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console(),
    ],
  };
const logColors = {
    info: "blue",
    debug: "magenta",
    warn: "yellow",
    error: "red"
}
winston.addColors(logColors);
const logger = winston.createLogger(options);

export default logger;
