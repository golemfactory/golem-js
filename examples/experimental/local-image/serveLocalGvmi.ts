import { GolemNetwork, serveLocalGvmi } from "@golem-sdk/golem-js/experimental";
import { fileURLToPath } from "url";

// get the absolute path to the local image in case this file is run from a different directory
const localImagePath = fileURLToPath(new URL("alpine.gvmi", import.meta.url).toString());

const server = serveLocalGvmi(localImagePath);
const golem = new GolemNetwork({
  yagna: {
    apiKey: "try_golem",
  },
  package: {
    localImageServer: server,
  },
});

async function main() {
  console.log("Serving local image to the providers...");
  await server.serve();
  await golem.init();

  const job = golem.createJob<string>();
  job.startWork(async (ctx) => {
    return String((await ctx.run("cat hello.txt")).stdout);
  });
  const result = await job.waitForResult();
  console.log("Job finished!");
  console.log(result);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await golem.close();
    console.log("Stoping the local image server...");
    await server.close();
  });
