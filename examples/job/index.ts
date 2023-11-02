import { GolemNetwork } from "@golem-sdk/golem-js";

const golem = new GolemNetwork({});

async function main() {
  await golem.init();

  const job = await golem.createJob<string>();
  console.log("Job object created, status is ", job.state);

  job.eventTarget.addEventListener("started", () => {
    console.log("Job started event emitted");
  });
  job.eventTarget.addEventListener("success", () => {
    console.log("Job success event emitted");
  });
  job.eventTarget.addEventListener("error", () => {
    console.log("Job error event emitted");
  });
  job.eventTarget.addEventListener("ended", () => {
    console.log("Job ended event emitted");
  });

  job.startWork(
    async (ctx) => {
      return String((await ctx.run("echo -n 'Hello Golem!'")).stdout);
    },
    {
      package: {
        imageTag: "golem/alpine:latest",
      },
    },
  );

  console.log("Job started, status is ", job.state);

  const result = await job.waitForResult();
  console.log("Job finished, result is ", result);

  // later

  const sameJobAgain = golem.getJobById(job.id);

  console.log("Retrieved job object, result is ", sameJobAgain!.results);

  await golem.close();
  console.log("Golem network closed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
