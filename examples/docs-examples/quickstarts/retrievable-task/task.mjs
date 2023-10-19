import { GolemNetwork, JobState } from "@golem-sdk/golem-js";

const golem = new GolemNetwork({
  yagnaOptions: { apiKey: "try_golem" },
});
await golem.init();
const job = await golem.createJob(async (ctx) => {
  const response = await ctx.run("echo 'Hello, Golem!'");
  return response.stdout;
});

let state = await job.fetchState();
while (state === JobState.Pending || state === JobState.New) {
  console.log("Job is still running...");
  await new Promise((resolve) => setTimeout(resolve, 1000));
  state = await job.fetchState();
}

console.log("Job finished with state:", state);
const result = await job.fetchResults();
console.log("Job results:", result);

await golem.close();
