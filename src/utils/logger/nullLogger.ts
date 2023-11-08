import { Logger } from "./logger";

export function nullLogger(): Logger {
  const nullFunc = () => {
    // Do nothing.
  };

  return {
    level: "info",
    debug: nullFunc,
    info: nullFunc,
    log: nullFunc,
    warn: nullFunc,
    error: nullFunc,
    setLevel: nullFunc,
  };
}
