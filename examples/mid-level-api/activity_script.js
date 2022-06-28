const { ActivityFactory } = require("../../dist/mid-level-api/activity");
const { Deploy, Start, Run, Terminate, Script } = require("../../dist/mid-level-api/script");

async function main() {
  const agreementId = "4b8b80d54f79932dc842c0835035c789ca90c921a62f0e9ad92a612210846093";
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

  results.on(
    "data",
    (result) => console.log(`command #${result.index}`, "result:", result.result, "stdout: ", result.stdout)
    // (result) => console.log(result)
  );

  results.on("end", async () => {
    await script.after();
    console.log("Script finished.");
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
