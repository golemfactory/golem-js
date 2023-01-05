/**
 * @ignore
 */
export const isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined";
/**
 * @ignore
 */
export const isNode = typeof process !== "undefined" && process.versions != null && process.versions.node != null;
/**
 * @ignore
 */
export const isWebWorker =
  typeof self === "object" && self.constructor && self.constructor.name === "DedicatedWorkerGlobalScope";
/**
 * @ignore
 */
export function checkAndThrowUnsupportedInBrowserError(feature: string) {
  if (isBrowser) throw new Error(`Feature ${feature} is unsupported in the browser.`);
}
