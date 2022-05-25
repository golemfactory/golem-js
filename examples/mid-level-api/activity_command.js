const { Activity, ActivityFactory } = require("../../dist/mid-level-api/activity");
const { Run, Start, Deploy, Terminate } = require("../../dist/mid-level-api/script");

async function main() {
  const agreementId = "de853ce07ab76f95f3539d9312fe1c91735e246e4a7fcd7693ba272e75b47e4f";
  const activityFactory = new ActivityFactory();
  const activityId = await activityFactory.create(agreementId).catch((e) => console.error(e));
  const activity = new Activity(activityId);
  activity.on("StateChanged", (e) => console.log("EVENT: ", e));

  await activity.executeCommand(new Deploy());
  await activity.executeCommand(new Start());
  const command = new Run("/bin/sh", ["-c", "date"]);
  const commandResult = await activity.executeCommand(command).catch((e) => console.error(e));
  console.log("RESULTS: ", commandResult);
  await activity.executeCommand(new Terminate());
  // await activity.stop();
  setTimeout(() => {
    console.log("END");
  }, 100000);
}

main();
