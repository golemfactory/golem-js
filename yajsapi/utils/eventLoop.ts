import bluebird from "bluebird";
import logger from "./log";

export default function get_event_loop() {
  bluebird.Promise.config({ cancellation: true });
  return {
    create_task: bluebird.coroutine(function* (fn): any {
      console.log("coroutine", fn)
      yield new bluebird.Promise(async (resolve, reject, onCancel) => {
        try {
          let result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
        if(onCancel) onCancel(() => {
            logger.warn("cancelled!");
            reject("cancelled!");
          });
      });
    }) as any,
  };
}
