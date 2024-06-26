import { GolemNetwork } from "@golem-sdk/golem-js/experimental";

const golem = new GolemNetwork({
  yagna: { apiKey: "try_golem" },
});
await golem.init();

const job = golem.createJob({
  package: {
    imageTag: "golem/alpine:latest",
  },
});
job.startWork(async (exe) => {
  const response = await exe.run("echo 'Hello, Golem!'");
  return response.stdout;
});

const result = await job.waitForResult();

console.log("Job finished with state:", job.state);
console.log("Job results:", result);

await golem.close();
