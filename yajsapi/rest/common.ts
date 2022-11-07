import { Callable, sleep } from "../utils";
import { Logger } from "../utils/logger";

export function is_intermittent_error(e) {
  if (e.response && (e.response.status === 408 || e.response.status === 504)) {
    return true;
  }
  if (e.code === "ECONNABORTED" && e.message && e.message.includes("timeout")) {
    return true;
  }
  if (e.code === "ETIMEDOUT") {
    return true;
  }
  if (e.code === "EPIPE") {
    return true;
  }
  return false;
}

export async function suppress_exceptions(
  condition: Callable<Error, boolean>,
  block: Callable<void, any>,
  function_name: string,
  report_exceptions = true,
  logger?: Logger
): Promise<any> {
  try {
    return await block();
  } catch (error) {
    if (condition(error)) {
      logger?.debug(`Exception suppressed in ${function_name}: ${error}`);
    } else {
      throw error;
    }
  }
}

export async function repeat_on_error(
  block: Callable<void, any>,
  function_name: string,
  max_tries = 5,
  max_duration_ms = 15000,
  interval_ms = 1000,
  condition: Callable<Error, boolean> = is_intermittent_error,
  logger?: Logger
) {
  const start_time = Date.now();
  for (let try_num = 1; try_num <= max_tries; ++try_num) {
    if (try_num > 1) {
      await sleep(Math.min(interval_ms, start_time + max_duration_ms - Date.now()) / 1000);
    }
    let err_in_block, ret_value;
    await suppress_exceptions(
      condition,
      async () => {
        try {
          ret_value = await block();
        } catch (error) {
          err_in_block = error;
          throw error;
        }
      },
      function_name
    );
    if (err_in_block === undefined) {
      if (try_num > 1) {
        logger?.debug(`API call to ${function_name} succeeded after ${try_num} attempts.`);
      }
      return ret_value;
    }
    const duration = Date.now() - start_time;
    const repeat = try_num < max_tries && duration < max_duration_ms;
    const msg =
      `API call to ${function_name} timed out (attempt ${try_num}/${max_tries}), ` +
      (repeat ? `retrying in ${interval_ms}ms` : `giving up after ${duration}ms`);
    logger?.debug(msg);
    if (!repeat) {
      throw err_in_block;
    }
  }
}
