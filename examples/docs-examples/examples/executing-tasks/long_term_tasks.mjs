import dotenv from "dotenv";

import { TaskExecutor, LogLevel } from "@golem-sdk/golem-js";

dotenv.config();

(async function main() {
  const executor = await TaskExecutor.create({
    // What do you want to run
    package: "golem/node:latest",
    yagnaOptions: { apiKey: "try_golem" },
    budget: 0.5,

    expirationSec: 80 * 60, // 80 min - time is measured from publishing demand on the market

    //midAgreementDebitNoteIntervalSec: 2 * 60, // 2 minutes

    //debitNotesAcceptanceTimeoutSec:  2 * 60, // 2 minutes   x2
    //midAgreementPaymentTimeoutSec: 12 * 60 * 60, // 12 hours  x2

    expires: 1000 * 60 * 90, // allocation duration,   default 1h

    // Useful for debugging
    logLevel: LogLevel.Info,
    taskTimeout: 90 * 60 * 1000, // single task execution timeout
  });

  try {
    const result = await executor.run(async (ctx) => {
      console.log("Working on the provider: ", ctx.provider.name);
      for (var i = 0; i < 70; i++) {
        console.log(new Date().toLocaleString(), "Will run command no: ", i);
        console.log((await ctx.run("ls -l")).stdout); // run a command on the provider
        await new Promise((res) => setTimeout(res, 60 * 1000)); // sleep for a minute
      }
      return 0;
    });
    if (result == 1) console.log("task completed");
  } catch (err) {
    console.error("Running the task on Golem failed due to", err);
  } finally {
    await executor.shutdown();
  }
})();
