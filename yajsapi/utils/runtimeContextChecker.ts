export const isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined";

export const isNode = typeof process !== "undefined" && process.versions != null && process.versions.node != null;

export const isWebWorker = typeof self === "object" && self.constructor && self.constructor.name === "DedicatedWorkerGlobalScope";

export function checkAndThrowUnsupportedInBrowserError(feature: string) {
  if (isBrowser) throw new Error(`Feature ${feature} is unsupported in the browser.`);
}
