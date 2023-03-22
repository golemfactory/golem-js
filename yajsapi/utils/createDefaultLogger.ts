import { createPinoLogger } from "./createPinoLogger.js";

export function createDefaultLogger(filename?: string) {
  return createPinoLogger({
    transport: {
      target: "pino-pretty",
      options: {
        destination: filename,
        colorize: !filename,
        ignore: "pid,hostname",
      },
    },
  });
}