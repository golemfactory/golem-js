import { Logger } from "./logger";

export function nullLogger(): Logger {
  const nullFunc = () => {
    // Do nothing.
  };

  return {
    child: () => nullLogger(),
    debug: nullFunc,
    info: nullFunc,
    warn: nullFunc,
    error: nullFunc,
  };
}
