import { pinoLogger } from "./pinoLogger.js";

export function defaultLogger(filename?: string) {
  return pinoLogger({
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
