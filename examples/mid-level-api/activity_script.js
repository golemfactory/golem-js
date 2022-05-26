const { Activity, ActivityFactory } = require("../../dist/mid-level-api/activity");
const { Deploy, Start, Run, Terminate, Script } = require("../../dist/mid-level-api/script");

async function main() {
  const agreementId = "9a8cc21fbc419d4eceb898fe2d275ac2b545d81b90a87b2f4ba3834c5442cba4";
  const activityFactory = new ActivityFactory();
  const activityId = await activityFactory.create(agreementId).catch((e) => console.error(e));
  const activity = new Activity(activityId, { stateFetchInterval: 1000 });
  activity.on("StateChanged", (e) => {
    console.log("[EVENT] State changed: ", e);
    if (e === "Terminated") process.exit(1);
  });

  const command1 = new Deploy();
  const command2 = new Start();
  const command3 = new Run("/bin/sh", ["-c", 'date +"DATE1: %d-%m-%Y %H:%m:%S.%s"']);
  const command4 = new Run("/bin/sh", ["-c", 'date +"DATE2: %d-%m-%Y %H:%m:%S.%s"']);
  const command5 = new Run("/bin/sh", ["-c", 'date +"DATE3: %d-%m-%Y %H:%m:%S.%s"']);
  const command6 = new Terminate();

  const script = new Script([command1, command2, command3, command4, command5, command6]);

  const scriptResults = await activity
    .executeScript(script)
    .catch((e) => console.error(e?.request?.response?.data?.message || e));
  for await (const result of scriptResults) {
    console.log(`command #${result.index}`, "result:", result.result, "stdout: ", result.stdout);
  }
}

main();
