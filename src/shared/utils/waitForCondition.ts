import { clearInterval } from "node:timers";
import { GolemTimeoutError } from "../error/golem-error";

/**
 * Utility function that helps to block the execution until a condition is met (check returns true) or the timeout happens.
 *
 * @param {function} check - The function checking if the condition is met.
 * @param {Object} [opts] - Options controlling the timeout and check interval in seconds.
 * @param {number} [opts.timeoutSeconds=15] - The timeout value in seconds.
 * @param {number} [opts.intervalSeconds=1] - The interval between condition= checks in seconds.
 *
 * @return {Promise<void>} - Resolves when the condition is met or rejects with a timeout error if it wasn't met on time.
 */
export function waitForCondition(
  check: () => boolean,
  opts = { timeoutSeconds: 15, intervalSeconds: 1 },
): Promise<void> {
  let verifyInterval: NodeJS.Timeout | undefined;
  let waitTimeout: NodeJS.Timeout | undefined;

  const verify = new Promise<void>((resolve) => {
    verifyInterval = setInterval(() => {
      if (check()) {
        clearInterval(verifyInterval);
        resolve();
      }
    }, opts.intervalSeconds * 1000);
  });

  const wait = new Promise<void>((_, reject) => {
    waitTimeout = setTimeout(() => {
      reject(new GolemTimeoutError(`Condition was not met within ${opts.timeoutSeconds}s`));
    }, opts.timeoutSeconds * 1000);
  });

  return Promise.race([verify, wait]).finally(() => {
    clearInterval(verifyInterval);
    clearTimeout(waitTimeout);
  });
}
