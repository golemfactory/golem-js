import { TaskExecutor } from "@golem-sdk/golem-js";
import { createHash } from "node:crypto";
import * as fs from "fs";

(async () => {
  const executor = await TaskExecutor.create({
    package: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
    yagnaOptions: { apiKey: "try_golem" },
  });

  const buff = fs.readFileSync("worker.mjs");
  const hash = createHash("md5").update(buff).digest("hex");

  try {
    const result = await executor.run(async (ctx) => {
      await ctx.uploadFile("./worker.mjs", "/golem/input/worker.mjs");

      const res = await ctx.run(
        `node -e "const crypto = require('node:crypto'); const fs = require('fs'); const buff = fs.readFileSync('/golem/input/worker.mjs'); const hash = crypto.createHash('md5').update(buff).digest('hex'); console.log(hash);"`,
      );

      return res.stdout;
    });

    console.log("md5 of the file sent to provider: ", result);
    console.log("Locally computed md5: ", hash);
  } catch (error) {
    console.error("Computation failed:", error);
  } finally {
    await executor.shutdown();
  }
})();
