import { Callable, logger, sleep } from "../utils";

export function is_intermittent_error(e) {
  if (e.response && (e.response.status === 408 || e.response.status === 504)) { return true; }
  if (e.code === "ECONNABORTED" && e.message && e.message.includes("timeout")) { return true; }
  if (e.code === "ETIMEDOUT") { return true; }
  if (e.code === "EPIPE") { return true; }
  return false;
}

export async function suppress_exceptions(
  condition: Callable<Error, boolean>,
  block: Callable<void, any>,
  report_exceptions: boolean = true
): Promise<any> {
  try {
    return await block();
  } catch (error) {
    if (condition(error)) {
      logger.debug(`Exception suppressed: ${error}`);
    } else {
      throw error;
    }
  }
}

export async function repeat_on_error(
  block: Callable<void, any>,
  max_tries: number = 5,
  max_duration_ms = 15000,
  interval: number = 0.0,
  condition: Callable<Error, boolean> = is_intermittent_error
) {
  let start_time = Date.now();
  for (let try_num = 1; try_num <= max_tries; ++try_num) {
    if (try_num > 1) {
      await sleep(Math.min(interval, start_time + max_duration_ms - Date.now()));
    }
    let err_in_block, ret_value;
    await suppress_exceptions(condition, async () => {
      try {
        ret_value = await block();
      } catch (error) {
        err_in_block = error;
        throw error;
      }
    });
    if (err_in_block === undefined) { return ret_value; }
    const duration = Date.now() - start_time;
    const repeat = try_num < max_tries && duration < max_duration_ms;
    const msg = `API call timed out (attempt ${try_num}/${max_tries}), ` +
              (repeat ? `retrying in ${interval}s` : `giving up after ${duration}ms`);
    logger.debug(msg);
    if (!repeat) { throw err_in_block; }
  }
}
