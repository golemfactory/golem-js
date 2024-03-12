import { GolemTimeoutError } from "../error/golem-error";

function timeout(milliseconds: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new GolemTimeoutError("Timeout for the operation was reached")), milliseconds);
  });
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([promise, timeout(timeoutMs)]);
}
