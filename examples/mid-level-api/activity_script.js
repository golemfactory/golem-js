const { ActivityFactory } = require("../../dist/mid-level-api/activity");
const { Deploy, Start, Run, Terminate, Script } = require("../../dist/mid-level-api/script");

async function main() {
  const agreementId = "e828bd0682c0b3efd591e5567ec52c3fe3b3efd0dbf0cbd6a298f10cbbb2ca46";
  const activityFactory = new ActivityFactory();
  const activity = await activityFactory.create(agreementId);

  const command1 = new Deploy();
  const command2 = new Start();
  const command3 = new Run("/bin/sh", ["-c", 'date +"DATE1: %d-%m-%Y %H:%m:%S.%s"']);
  const command4 = new Run("/bin/sh", ["-c", 'date +"DATE2: %d-%m-%Y %H:%m:%S.%s"']);
  const command5 = new Run("/bin/sh", ["-c", 'date +"DATE3: %d-%m-%Y %H:%m:%S.%s"']);
  const command6 = new Terminate();

  const script = new Script([command1, command2, command3, command4, command5, command6]);
  await script.before();
  const results = await activity.execute(script.getExeScriptRequest());

  results.on("data", (result) =>
    console.log(`command #${result.index}`, "result:", result.result, "stdout: ", result.stdout)
  );

  results.on("end", async () => {
    await script.after();
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
