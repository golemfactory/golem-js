import { ActivityApi } from "ya-ts-client";
import { Readable } from "stream";
import { ResultData } from "../../src/activity/results";

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
export const simulateLongPoll = <T>(response: T, pollingTimeMs: number = 10) =>
  new Promise<T>((resolve) => {
    setTimeout(() => resolve(response), pollingTimeMs);
  });

/**
 * Helper function that makes preparing activity result returned by Activity.execute function
 */
export const buildExecutorResults = (successResults?: ResultData[], errorResults?: ResultData[], error?: Error) => {
  return new Readable({
    objectMode: true,
    async read() {
      if (error) {
        this.emit("error", error);
      }
      const results = successResults?.length
        ? successResults.shift()
        : errorResults?.length
          ? errorResults.shift()
          : null;
      this.push(results);
    },
  });
};
