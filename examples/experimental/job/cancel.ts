import { JobManager } from "@golem-sdk/golem-js/experimental";
import { MarketOrderSpec } from "@golem-sdk/golem-js";
const golem = new JobManager({
  yagna: {
    apiKey: "try_golem",
  },
});

const order: MarketOrderSpec = {
  demand: {
    workload: { imageTag: "severyn/espeak:latest" },
  },
  market: {
    rentHours: 0.5,
    pricing: {
      model: "linear",
      maxStartPrice: 1,
      maxCpuPerHourPrice: 1,
      maxEnvPerHourPrice: 1,
    },
  },
};

async function main() {
  await golem.init();

  const job = golem.createJob<string>(order);

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
