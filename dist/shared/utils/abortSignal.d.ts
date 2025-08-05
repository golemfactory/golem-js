/**
 * If provided an AbortSignal, returns it.
 * If provided a number, returns an AbortSignal that will be aborted after the specified number of milliseconds.
 * If provided undefined, returns an AbortSignal that will never be aborted.
 */
export declare function createAbortSignalFromTimeout(timeoutOrSignal: number | AbortSignal | undefined): AbortSignal;
/**
 * Combine multiple AbortSignals into a single signal that will be aborted if any
 * of the input signals are aborted. If any of the input signals are already aborted,
 * the returned signal will be aborted immediately.
 *
 * Polyfill for AbortSignal.any(), since it's only available starting in Node 20
 * https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static
 *
 * The function returns a signal and a cleanup function that allows you
 * to remove listeners when they are no longer needed.
 */
export declare function anyAbortSignal(...signals: AbortSignal[]): {
    signal: AbortSignal;
    cleanup: () => void;
};
