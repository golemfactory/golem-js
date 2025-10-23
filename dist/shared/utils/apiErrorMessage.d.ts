/**
 * Try to extract a message from a yagna API error.
 * If the error is not an instance of `ApiError`, return the error message.
 */
export declare function getMessageFromApiError(error: unknown): string;
