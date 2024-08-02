import { GolemAbortError } from "../error/golem-error";

/**
 * Utility function that helps to block the execution until a condition is met (check returns true) or the timeout happens.
 *
 * @param {function} check - The function checking if the condition is met.
 * @param {Object} [opts] - Options controlling the timeout and check interval in seconds.
 * @param {AbortSignal} [opts.abortSignal] - AbortSignal to respect when waiting for the condition to be met
 * @param {number} [opts.intervalSeconds=1] - The interval between condition checks in seconds.
 *
 * @return {Promise<void>} - Resolves when the condition is met or rejects with a timeout error if it wasn't met on time.
 */
export function waitFor(
  check: () => boolean | Promise<boolean>,
  opts?: { abortSignal?: AbortSignal; intervalSeconds?: number },
): Promise<void> {
  const intervalSeconds = opts?.intervalSeconds ?? 1;

  let verifyInterval: NodeJS.Timeout | undefined;

  const verify = new Promise<void>((resolve, reject) => {
    verifyInterval = setInterval(async () => {
      if (opts?.abortSignal?.aborted) {
        reject(new GolemAbortError("Waiting for a condition has been aborted", opts.abortSignal.reason));
      }

      if (await check()) {
        resolve();
      }
    }, intervalSeconds * 1000);
  });

  return verify.finally(() => {
    clearInterval(verifyInterval);
  });
}

/**
 * Simple utility that allows you to wait n-seconds and then call the provided function
 */
export function waitAndCall<T>(fn: () => Promise<T> | T, waitSeconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(async () => {
      try {
        const val = await fn();
        resolve(val);
      } catch (err) {
        reject(err);
      }
    }, waitSeconds * 1_000);
  });
}
