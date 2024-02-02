import * as dotenv from "dotenv";
import { TaskExecutor } from "@golem-sdk/golem-js";

dotenv.config();

(async function main() {
  const eventTarget = new EventTarget();

  eventTarget.addEventListener("GolemEvent", (event) => {
    let eventName = event.constructor.name;

    if (eventName != "ProposalRejected") {
      console.log(new Date(), eventName);
    }
  });

  const executor = await TaskExecutor.create({
    package: "golem/node:20",
    taskTimeout: 20 * 60 * 1000, // 20 MIN
    eventTarget,
    yagnaOptions: { apiKey: "try_golem" },
  });

  console.log("Executor is created");
  try {
    await executor.run(async (ctx) => {
      console.log("Will run the command");
      console.log((await ctx.run("ls -l")).stdout);
    });
    console.log("Finished");
  } catch (err) {
    console.error("This error broke the computations", err);
  } finally {
    console.log("Will shotdown the executor.");
    await executor.shutdown();
  }
})();
