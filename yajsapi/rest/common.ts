import { logger, sleep } from "../utils";

export function is_intermittent_error(e) {
  if (e.response && e.response.status === 408) { return true; }
  if (e.code === "ECONNABORTED" && e.message && e.message.includes("timeout")) { return true; }
  if (e.code === "ETIMEDOUT") { return true; }
  return false;
}

export async function suppress_exceptions(
  condition: any,
  block: any,
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
  block: any,
  max_tries: number = 5,
  condition: any,
  interval: number = 0.0
) {
  for (let try_num = 1; try_num <= max_tries; ++try_num) {
    if (try_num > 1) {
      await sleep(interval);
    }
    try {
      return await suppress_exceptions(condition, async () => {
        return await block();
      });
    } catch (error) {
      let repeat = try_num < max_tries;
      let msg = `API call timed out (attempt ${try_num}/${max_tries}), ` +
                repeat ? `retrying in ${interval} s` : "giving up";
      logger.debug(msg);
      if (!repeat) { throw error; }
    }
  }
}
