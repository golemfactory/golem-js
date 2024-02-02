import { GolemNetwork } from "@golem-sdk/golem-js";

const golem = new GolemNetwork({
  yagna: {
    apiKey: "try_golem",
  },
});

function startJob() {
  const job = golem.createJob<string>({
    package: {
      imageTag: "golem/alpine:latest",
    },
  });

  console.log("Job object created, initial status is", job.state);

  job.events.addListener("started", () => {
    console.log("Job started event emitted");
  });
  job.events.addListener("success", () => {
    console.log("Job success event emitted");
  });
  job.events.addListener("ended", () => {
    console.log("Job ended event emitted");
  });

  job.startWork(async (ctx) => {
    return String((await ctx.run("echo -n 'Hello Golem!'")).stdout);
  });
  return job.id;
}

async function main() {
  await golem.init();
  const jobId = startJob();

  const jobObject = golem.getJobById(jobId);
  const result = await jobObject!.waitForResult();

  console.log("Job finished, result is ", result);
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
