import { TaskExecutor } from "@golem-sdk/golem-js";

import { readFile } from "fs/promises";

const manifest = await readFile(`./manifest_npm_install.json`);

(async function main() {
  const executor = await TaskExecutor.create({
    // What do you want to run
    capabilities: ["inet", "manifest-support"],
    manifest: manifest.toString("base64"),

    yagnaOptions: { apiKey: "try_golem" },
    budget: 0.5,

    expires: 1000 * 60 * 30, //h

    // Control the execution of tasks
    maxTaskRetries: 0,

    taskTimeout: 120 * 60 * 1000,
  });

  try {
    await executor.run(async (ctx) => {
      console.log("working on provider: ", ctx.provider.id);

      console.log((await ctx.run("npm install moment")).stdout);
      console.log((await ctx.run(`cat ./package.json`)).stdout);

      return 1;
    });

    console.log("task completed");
  } catch (err) {
    console.error("Running the task on Golem failed due to", err);
  } finally {
    await executor.end();
  }
})();
