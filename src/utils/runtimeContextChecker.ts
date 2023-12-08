import { GolemError } from "../error/golem-error";

/**
 * @ignore
 */
export const isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined";

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
  if (isBrowser) throw new GolemError(`Feature ${feature} is unsupported in the browser.`);
}
