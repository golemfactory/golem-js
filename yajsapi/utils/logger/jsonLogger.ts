import { Logger } from "./logger.js";
import { pinoLogger } from "./pinoLogger.js";

/**
 * Create a logger that writes a JSON object for every log line.
 * @param filename path to the file to write to, if not specified, logs are written to stdout
 */
export function jsonLogger(filename?: string): Logger {
  return pinoLogger({
    transport: {
      target: "pino/file",
      options: {
        destination: filename,
        ignore: "pid,hostname",
      },
    },
  });
}
