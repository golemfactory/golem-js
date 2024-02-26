import { ActivityApi } from "ya-ts-client";

/**
 * Helper function that makes it easy to prepare successful exec results creation
 */
export const buildExeScriptSuccessResult = (stdout: string): ActivityApi.ExeScriptCommandResultDTO => ({
  index: 0,
  eventDate: new Date().toISOString(),
  result: "Ok",
  stdout: stdout,
  stderr: "",
  message: "",
  isBatchFinished: true,
});

/**
 * Helper function that makes preparing error exec results creation
 */
export const buildExeScriptErrorResult = (
  stderr: string,
  message: string,
  stdout = "",
): ActivityApi.ExeScriptCommandResultDTO => ({
  index: 0,
  eventDate: new Date().toISOString(),
  result: "Error",
  stdout: stdout,
  stderr: stderr,
  message: message,
  isBatchFinished: true,
});

/**
 * Use it to simulate responses from a "long-polled" API endpoint
 *
 * @param response The response to return after "polling time"
 * @param pollingTimeSec The time to wait before returning the response
 */
export const simulateLongPoll = <T>(response: T, pollingTimeSec: number = 1) =>
  new Promise<T>((resolve) => {
    setTimeout(() => resolve(response), pollingTimeSec * 1000);
  });
