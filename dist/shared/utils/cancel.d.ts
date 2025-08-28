type CancelablePromise<T> = Promise<T> & {
    cancel: () => void;
};
/**
 * Cancel a call to yagna api if the given abort signal gets aborted
 */
export declare function cancelYagnaApiCall<T>(yangaApiCancellablePromise: CancelablePromise<T>, signal: AbortSignal): Promise<T>;
export {};
