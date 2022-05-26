const { Activity, ActivityFactory } = require("../../dist/mid-level-api/activity");
const { Run, Start, Deploy, Terminate } = require("../../dist/mid-level-api/script");

async function main() {
  const agreementId = "769d892c72f10ca4e3df3afd96178d90edd6f5acca74bfd0a52f4aecbcecb707";
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
  await activity.stop();
}

main();
