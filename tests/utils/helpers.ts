import { map, of, throwError } from "rxjs";
import { Result, ResultData } from "../../src/activity/results";

/**
 * Helper function that makes it easy to prepare successful exec results creation
 */
export const buildExeScriptSuccessResult = (stdout: string): Result =>
  new Result({
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
export const buildExeScriptErrorResult = (stderr: string, message: string, stdout = ""): Result =>
  new Result({
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
  if (error) {
    return throwError(() => error);
  }
  return of(...(successResults ?? []), ...(errorResults ?? [])).pipe(map((resultData) => new Result(resultData)));
};
