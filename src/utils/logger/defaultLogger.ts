import { pinoLogger } from "./pinoLogger";

export function defaultLogger(filename?: string) {
  return pinoLogger({
    transport: {
      target: "pino-pretty",
      options: {
        destination: filename,
        colorize: !filename,
        ignore: "pid,hostname",
        /** {@see https://github.com/pinojs/pino-pretty#usage-with-jest} */
        sync: true,
      },
    },
  });
}
