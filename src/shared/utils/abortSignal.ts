/**
 * If provided an AbortSignal, returns it.
 * If provided a number, returns an AbortSignal that will be aborted after the specified number of milliseconds.
 * If provided undefined, returns an AbortSignal that will never be aborted.
 */
export function createAbortSignalFromTimeout(timeoutOrSignal: number | AbortSignal | undefined) {
  if (timeoutOrSignal instanceof AbortSignal) {
    return timeoutOrSignal;
  }
  if (typeof timeoutOrSignal === "number") {
    return AbortSignal.timeout(timeoutOrSignal);
  }
  return new AbortController().signal;
}
