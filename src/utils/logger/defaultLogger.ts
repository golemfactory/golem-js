import debug from "debug";

export function defaultLogger(namespace: string) {
  const logger = debug(namespace);

  function info(msg: string): void;
  function info(msg: string, ctx?: Record<string, unknown> | Error) {
    if (ctx) {
      logger(`${msg} %o`, ctx);
    } else {
      logger(msg);
    }
  }

  function error(msg: string): void;
  function error(msg: string, ctx?: Record<string, unknown> | Error) {
    if (ctx) {
      logger(`${msg} %o`, ctx);
    } else {
      logger(msg);
    }
  }

  return {
    child: (childNamespace: string) => defaultLogger(`${namespace}:${childNamespace}`),
    info,
    error,
  };
}
