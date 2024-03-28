import { GolemTimeoutError } from "../error/golem-error";

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeout = (milliseconds: number): Promise<never> =>
    new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new GolemTimeoutError("Timeout for the operation was reached")),
        milliseconds,
      );
    });
  return Promise.race([promise, timeout(timeoutMs)]).finally(() => clearTimeout(timeoutId));
}
