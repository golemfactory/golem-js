import { GolemNetwork } from "@golem-sdk/golem-js";

const golem = new GolemNetwork({});

async function main() {
  await golem.init();
  const job = await golem.createJob();

  job.eventTarget.addEventListener("started", () => {
    console.log("Job started");
  });
  job.eventTarget.addEventListener("success", () => {
    console.log("Job success");
  });
  job.eventTarget.addEventListener("error", () => {
    console.log("Job error");
  });
  job.eventTarget.addEventListener("ended", () => {
    console.log("Job ended");
  });

  job.run(
    async (ctx) => {
      return (await ctx.run("echo 'Hello from Golem'")).stdout;
    },
    {
      package: {
        imageTag: "golem/alpine:latest",
      },
    },
  );

  console.log({
    state: job.state,
    isRunning: job.isRunning,
  });

  const result = await job.waitForResult();
  console.log(result);

  // later

  const sameJobAgain = golem.getJobById(job.id);

  console.log({
    state: sameJobAgain!.state,
    isRunning: sameJobAgain!.isRunning,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
