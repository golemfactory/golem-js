import { clearInterval } from "node:timers";
import { GolemTimeoutError } from "../error/golem-error";

/**
 * Utility function that helps to block the execution until a condition is met (check returns true) or the timeout happens
 *
 * @param check The function checking if the condition is met
 * @param opts Options controlling the timeout and check interval in seconds
 *
 * @return Resolves when the condition is met or rejects with a timeout error if it wasn't met on time
 */
export function waitForCondition(
  check: () => boolean,
  opts = { timeoutSeconds: 15, intervalSeconds: 1 },
): Promise<void> {
  let verifyInterval: NodeJS.Timeout | undefined;

  const verify = new Promise<void>((resolve) => {
    verifyInterval = setInterval(() => {
      if (check()) {
        clearInterval(verifyInterval);
        resolve();
      }
    }, opts.intervalSeconds * 1000);
  });

  const timeout = new Promise<void>((_, reject) => {
    setTimeout(() => {
      reject(new GolemTimeoutError(`Condition was not met within ${opts.timeoutSeconds}s`));
    }, opts.timeoutSeconds * 1000);
  });

  return Promise.race([verify, timeout]).finally(() => clearInterval(verifyInterval));
}
