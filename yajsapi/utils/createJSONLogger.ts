import { Logger } from "./logger.js";
import { createPinoLogger } from "./createPinoLogger.js";

/**
 * Create a logger that writes a JSON object for every log line.
 * @param filename path to the file to write to, if not specified, logs are written to stdout
 */
export function createJSONLogger(filename?: string): Logger {
  return createPinoLogger({
    transport: {
      target: "pino/file",
      options: {
        destination: filename,
        ignore: "pid,hostname",
      }
    }
  });
}