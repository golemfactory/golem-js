type CancelablePromise<T> = Promise<T> & { cancel: () => void };

/**
 * Cancel a call to yagna api if the given abort signal gets aborted
 */
export async function cancelYagnaApiCall<T>(yangaApiCancellablePromise: CancelablePromise<T>, signal: AbortSignal) {
  signal.addEventListener("abort", () => {
    yangaApiCancellablePromise.cancel();
  });
  return yangaApiCancellablePromise;
}
