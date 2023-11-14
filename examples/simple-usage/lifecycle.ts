import { TaskExecutor } from "@golem-sdk/golem-js";

/**
 * This example shows how to use the TaskExecutor lifecycle events.
 */
(async function main() {
  console.log("Creating TaskExecutor and registering for lifecycle events...");
  const executor = await TaskExecutor.create("golem/alpine:latest");

  executor.events.on("terminating", () => {
    console.log("Lifecycle: TaskExecutor is about to be terminated");
  });

  executor.events.on("terminated", () => {
    console.log("Lifecycle: TaskExecutor is terminated. Exiting...");
    process.exit(0);
  });

  console.log("Calling TaskExecutor.end()");
  await executor.end();
  // process.exit() is called in an event handler above, so this message should not be displayed.
  console.log("Should not display this message.");
})();
