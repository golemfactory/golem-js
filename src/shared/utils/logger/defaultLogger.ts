import debugLogger from "debug";
import { Logger } from "./logger";

type DefaultLoggerOptions = {
  /**
   * Disables prefixing the root namespace with golem-js
   *
   * @default false
   */
  disableAutoPrefix: boolean;
};

function getNamespace(namespace: string, disablePrefix: boolean) {
  if (disablePrefix) {
    return namespace;
  } else {
    return namespace.startsWith("golem-js:") ? namespace : `golem-js:${namespace}`;
  }
}

/**
 * Creates a logger that uses the debug library. This logger is used by default by all entities in the SDK.
 *
 * If the namespace is not prefixed with `golem-js:`, it will be prefixed automatically - this can be controlled by `disableAutoPrefix` options.
 */
export function defaultLogger(
  namespace: string,
  opts: DefaultLoggerOptions = {
    disableAutoPrefix: false,
  },
): Logger {
  const namespaceWithBase = getNamespace(namespace, opts.disableAutoPrefix);
  const logger = debugLogger(namespaceWithBase);

  function log(level: string, msg: string, ctx?: Record<string, unknown> | Error) {
    if (ctx) {
      logger(`[${level}] ${msg} %o`, ctx);
    } else {
      logger(`[${level}] ${msg}`);
    }
  }

  function debug(msg: string): void;
  function debug(msg: string, ctx?: Record<string, unknown> | Error) {
    log("DEBUG", msg, ctx);
  }

  function info(msg: string): void;
  function info(msg: string, ctx?: Record<string, unknown> | Error) {
    log("INFO", msg, ctx);
  }

  function warn(msg: string): void;
  function warn(msg: string, ctx?: Record<string, unknown> | Error) {
    log("WARN", msg, ctx);
  }

  function error(msg: string): void;
  function error(msg: string, ctx?: Record<string, unknown> | Error) {
    log("ERROR", msg, ctx);
  }

  return {
    child: (childNamespace: string) => defaultLogger(`${namespaceWithBase}:${childNamespace}`, opts),
    info,
    error,
    warn,
    debug,
  };
}
