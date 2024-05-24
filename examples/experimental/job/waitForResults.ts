import { JobManager } from "@golem-sdk/golem-js/experimental";

const golem = new JobManager({
  yagna: {
    apiKey: "try_golem",
  },
});

async function main() {
  await golem.init();

  const job = golem.createJob<string>({
    demand: {
      activity: {
        imageTag: "severyn/espeak:latest",
      },
    },
    market: {
      maxAgreements: 1,
      rentHours: 0.5,
      pricing: {
        model: "linear",
        maxStartPrice: 1,
        maxCpuPerHourPrice: 1,
        maxEnvPerHourPrice: 1,
      },
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

  const result = await job.waitForResult();
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
