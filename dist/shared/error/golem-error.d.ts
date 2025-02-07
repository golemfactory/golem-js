/**
 * Base class for all errors directly thrown by Golem SDK.
 */
export declare abstract class GolemError extends Error {
    /**
     * The previous error, if any, that led to this error.
     */
    readonly previous?: Error | undefined;
    constructor(message: string, 
    /**
     * The previous error, if any, that led to this error.
     */
    previous?: Error | undefined);
}
/**
 * User-caused errors in the Golem SDK containing logic errors.
 * @example you cannot create an activity for an agreement that already expired
 */
export declare class GolemUserError extends GolemError {
}
/**
 * Represents errors related to the user choosing to abort or stop running activities.
 * @example CTRL+C abort error
 */
export declare class GolemAbortError extends GolemUserError {
}
/**
 * Represents configuration errors.
 * @example Api key not defined
 */
export declare class GolemConfigError extends GolemUserError {
}
/**
 * Represents errors when the SDK encountered an internal error that wasn't handled correctly.
 * @example JSON.parse(undefined) -> Error: Unexpected token u in JSON at position 0
 */
export declare class GolemInternalError extends GolemError {
}
/**
 * Represents errors resulting from yagna’s errors or provider failure
 * @examples:
 *  - yagna results with a HTTP 500-error
 *  - the provider failed to deploy the activity - permission denied when creating the activity on the provider system itself
 */
export declare class GolemPlatformError extends GolemError {
}
/**
 * SDK timeout errors
 * @examples:
 *  - Not receiving any offers within the configured time.
 *  - The activity not starting within the configured time.
 *  - The request (task) timing out (started on an activity but didn't finish on time).
 *  - The request start timing out (the task didn't start within the configured amount of time).
 */
export declare class GolemTimeoutError extends GolemError {
}
/**
 * Module specific errors - Market, Work, Payment.
 * Each of the major modules will have its own domain specific root error type,
 * additionally containing an error code specific to a given subdomain
 */
export declare abstract class GolemModuleError extends GolemError {
    code: string | number;
    protected constructor(message: string, code: string | number, previous?: Error);
}
