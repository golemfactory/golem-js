import { Logger } from "./logger";

export function nullLogger(): Logger {
  const nullFunc = () => {
    // Do nothing.
  };

  return {
    child: () => nullLogger(),
    info: nullFunc,
    error: nullFunc,
  };
}
