import { Logger } from "./logger";
import * as pino from "pino";

export function pinoLogger(optionsOrStream?: pino.LoggerOptions | pino.DestinationStream): Logger {
  const logger = pino.pino(optionsOrStream);

  function debug(msg: string): void;
  function debug(msg: string, ctx?: Record<string, unknown> | Error) {
    logger.debug(ctx, msg);
  }

  function info(msg: string): void;
  function info(msg: string, ctx?: Record<string, unknown> | Error) {
    logger.info(ctx, msg);
  }

  function warn(msg: string): void;
  function warn(msg: string, ctx?: Record<string, unknown> | Error) {
    logger.warn(ctx, msg);
  }

  function error(msg: string): void;
  function error(msg: string, ctx?: Record<string, unknown> | Error) {
    logger.error(ctx, msg);
  }

  return {
    child: (namespace: string) => pinoLogger(logger.child({ namespace })),
    debug,
    warn,
    error,
    info,
  };
}
