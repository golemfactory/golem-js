const { ActivityFactory, ActivityStateEnum } = require("../../dist/mid-level-api/activity");
const { Run, Start, Deploy, Terminate } = require("../../dist/mid-level-api/script");

async function main() {
  const agreementId = "ac1df38c557eba142b68787ab47e14d6bfba2d80f64f627fe35d5aafd246417e";
  const activityFactory = new ActivityFactory();
  const activity = await activityFactory.create(agreementId);

  await activity.execute(new Deploy().toExeScriptRequest());
  await activity.execute(new Start().toExeScriptRequest());
  while ((await activity.getState()) !== ActivityStateEnum.Ready) {
    await new Promise((res) => setTimeout(res, 500));
  }
  const commandRun = new Run("/bin/sh", ["-c", "echo 'Hello World'"]);
  const commandRunResult = await activity.execute(commandRun.toExeScriptRequest());
  const { value: result } = await commandRunResult[Symbol.asyncIterator]().next();
  console.log("RESULTS: ", result);
  await activity.execute(new Terminate().toExeScriptRequest());
  await activity.stop();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
