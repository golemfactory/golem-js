import { GolemAbortError, GolemTimeoutError } from "../error/golem-error";
import { createAbortSignalFromTimeout } from "./abortSignal";

/**
 * Utility function that helps to block the execution until a condition is met (check returns true) or the timeout happens.
 *
 * @param {function} check - The function checking if the condition is met.
 * @param {Object} [opts] - Options controlling the timeout and check interval in seconds.
 * @param {number} [opts.signalOrTimeout=30_000] - The timeout value in miliseconds or AbortSignal.
 * @param {number} [opts.intervalSeconds=1] - The interval between condition checks in seconds.
 *
 * @return {Promise<void>} - Resolves when the condition is met or rejects with a timeout error if it wasn't met on time.
 */
export function waitFor(
  check: () => boolean | Promise<boolean>,
  opts?: { signalOrTimeout?: number | AbortSignal; intervalSeconds?: number },
): Promise<void> {
  const abortSignal = createAbortSignalFromTimeout(opts?.signalOrTimeout ?? 30_000);
  const intervalSeconds = opts?.intervalSeconds ?? 1;
  let verifyInterval: NodeJS.Timeout | undefined;

  const verify = new Promise<void>((resolve) => {
    verifyInterval = setInterval(async () => {
      if (await check()) {
        resolve();
      }
    }, intervalSeconds * 1000);
  });

  const wait = new Promise<void>((_, reject) => {
    const abortError = new GolemAbortError("Waiting for a condition has been aborted", abortSignal.reason);
    if (abortSignal.aborted) {
      return reject(abortError);
    }
    abortSignal.addEventListener("abort", () =>
      reject(
        abortSignal.reason.name === "TimeoutError"
          ? new GolemTimeoutError(`Waiting for a condition has been aborted due to a timeout`, abortSignal.reason)
          : abortError,
      ),
    );
  });

  return Promise.race([verify, wait]).finally(() => {
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
