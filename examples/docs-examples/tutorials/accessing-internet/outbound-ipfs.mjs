import { TaskExecutor } from "@golem-sdk/golem-js";
import { readFile } from "fs/promises";

const url = "https://ipfs.io/ipfs/bafybeihkoviema7g3gxyt6la7vd5ho32ictqbilu3wnlo3rs7ewhnp7lly";

(async function main() {
  // Load the manifest.
  const manifest = await readFile(`./manifest.json`);

  // Create and configure a TaskExecutor instance.
  const executor = await TaskExecutor.create({
    capabilities: ["inet", "manifest-support"],
    yagnaOptions: { apiKey: "try_golem" },
    manifest: manifest.toString("base64"),
  });

  try {
    await executor.run(async (ctx) => {
      const result = await ctx.run(`curl ${url} -o /golem/work/example.jpg`);

      console.log((await ctx.run("ls -l")).stdout);
      if (result.result === "Ok") {
        console.log("File downloaded!");
      } else {
        console.error("Failed to download the file!", result.stderr);
      }
    });
  } catch (err) {
    console.error("The task failed due to", err);
  } finally {
    await executor.end();
  }
})();
