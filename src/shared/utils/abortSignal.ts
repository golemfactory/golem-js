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

/**
 * Combine multiple AbortSignals into a single signal that will be aborted if any
 * of the input signals are aborted. If any of the input signals are already aborted,
 * the returned signal will be aborted immediately.
 *
 * Polyfill for AbortSignal.any(), since it's only available starting in Node 20
 * https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static
 */
export function anyAbortSignal(...signals: AbortSignal[]) {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener("abort", () => {
      if (controller.signal.aborted) return;
      controller.abort(signal.reason);
    });
  }
  return controller.signal;
}
