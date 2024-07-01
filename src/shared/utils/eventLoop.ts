/**
 * Run a callback on the next event loop iteration ("promote" a microtask to a task using setTimeout).
 * Note that this is not guaranteed to run on the very next iteration, but it will run as soon as possible.
 * This function is designed to avoid the problem of microtasks queueing other microtasks in an infinite loop.
 * See the example below for a common pitfall that this function can help avoid.
 * Learn more about microtasks and their relation to async/await here:
 * https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide/In_depth
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await#control_flow_effects_of_await
 * @param cb The callback to run on the next event loop iteration.
 * @example
 * ```ts
 * const signal = AbortSignal.timeout(1_000);
 * // This loop will run for 1 second, then stop.
 * while (!signal.aborted) {
 *   await runOnNextEventLoopIteration(() => Promise.resolve());
 * }
 *
 * const signal = AbortSignal.timeout(1_000);
 * // This loop will run indefinitely.
 * // Each while loop iteration queues a microtask, which itself queues another microtask, and so on.
 * while (!signal.aborted) {
 *   await Promise.resolve();
 * }
 * ```
 */
export function runOnNextEventLoopIteration<T>(cb: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => cb().then(resolve).catch(reject));
  });
}
