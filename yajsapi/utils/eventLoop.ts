import bluebird from "bluebird";

bluebird.Promise.config({ cancellation: true });

export default function get_event_loop() {
  return {
    create_task: bluebird.coroutine(function* (fn): any {
      return yield new bluebird.Promise(async (resolve, reject, onCancel) => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
        if (onCancel)
          onCancel(() => {
            console.warn("cancelled!");
            reject("cancelled!");
          });
      });
    }) as any,
  };
}
