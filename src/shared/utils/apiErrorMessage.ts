import YaTsClient from "ya-ts-client";
function isApiError(error: unknown): error is YaTsClient.ActivityApi.ApiError {
  return typeof error == "object" && error !== null && "name" in error && error.name === "ApiError";
}
/**
 * Try to extract a message from a yagna API error.
 * If the error is not an instance of `ApiError`, return the error message.
 */
export function getMessageFromApiError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  if (isApiError(error)) {
    try {
      return JSON.stringify(error.body, null, 2);
    } catch (_jsonParseError) {
      return error.message;
    }
  }
  return error.message;
}
