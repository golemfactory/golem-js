import { Logger } from "./logger";
import * as pino from "pino";

export function pinoLogger(optionsOrStream?: pino.LoggerOptions | pino.DestinationStream): Logger {
  const logger = pino.pino(optionsOrStream);

  function info(msg: string): void;
  function info(msg: string, ctx?: Record<string, unknown> | Error) {
    logger.info(ctx, msg);
  }

  function error(msg: string): void;
  function error(msg: string, ctx?: Record<string, unknown> | Error) {
    logger.error(ctx, msg);
  }

  return {
    child: (namespace: string) => pinoLogger(logger.child({ namespace })),
    info,
    error,
  };
}
