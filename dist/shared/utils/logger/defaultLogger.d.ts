import { Logger } from "./logger";
export type DefaultLoggerOptions = {
    /**
     * Disables prefixing the root namespace with golem-js
     *
     * @default false
     */
    disableAutoPrefix: boolean;
};
/**
 * Creates a logger that uses the debug library. This logger is used by default by all entities in the SDK.
 *
 * If the namespace is not prefixed with `golem-js:`, it will be prefixed automatically - this can be controlled by `disableAutoPrefix` options.
 */
export declare function defaultLogger(namespace: string, opts?: DefaultLoggerOptions): Logger;
