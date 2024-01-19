import debugLogger from "debug";

/**
 * Creates a logger that uses the debug library. This logger is used by default by all entities in the SDK.
 * If the namespace is not prefixed with `golem-js:`, it will be prefixed automatically.
 **/
export function defaultLogger(namespace: string) {
  const namespaceWithBase = namespace.startsWith("golem-js:") ? namespace : `golem-js:${namespace}`;
  const logger = debugLogger(namespaceWithBase);

  function log(msg: string, ctx?: Record<string, unknown> | Error) {
    if (ctx) {
      logger(`${msg} %o`, ctx);
    } else {
      logger(msg);
    }
  }

  function debug(msg: string): void;
  function debug(msg: string, ctx?: Record<string, unknown> | Error) {
    log(msg, ctx);
  }

  function info(msg: string): void;
  function info(msg: string, ctx?: Record<string, unknown> | Error) {
    log(msg, ctx);
  }

  function warn(msg: string): void;
  function warn(msg: string, ctx?: Record<string, unknown> | Error) {
    log(msg, ctx);
  }

  function error(msg: string): void;
  function error(msg: string, ctx?: Record<string, unknown> | Error) {
    log(msg, ctx);
  }

  return {
    child: (childNamespace: string) => defaultLogger(`${namespaceWithBase}:${childNamespace}`),
    info,
    error,
    warn,
    debug,
    log,
  };
}
