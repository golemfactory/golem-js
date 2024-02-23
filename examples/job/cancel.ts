import { GolemNetwork } from "@golem-sdk/golem-js/experimental";

const golem = new GolemNetwork({
  yagna: {
    apiKey: "try_golem",
  },
});

async function main() {
  await golem.init();

  const job = golem.createJob<string>({
    package: {
      imageTag: "golem/alpine:latest",
    },
  });

  console.log("Job object created, initial status is", job.state);

  job.events.addListener("started", () => {
    console.log("Job started event emitted");
  });
  job.events.addListener("error", (error) => {
    console.log("Job error event emitted with error:", error);
  });
  job.events.addListener("canceled", () => {
    console.log("Job canceled event emitted");
  });
  job.events.addListener("ended", () => {
    console.log("Job ended event emitted");
  });

  job.startWork(async (ctx) => {
    return String((await ctx.run("echo -n 'Hello Golem!'")).stdout);
  });

  console.log("Canceling job...");
  await job.cancel();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await golem.close();
    console.log("Golem network closed");
  });
