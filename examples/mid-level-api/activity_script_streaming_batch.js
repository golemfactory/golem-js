const { ActivityFactory } = require("../../dist/mid-level-api/activity");
const { Deploy, Start, Run, Terminate, Script } = require("../../dist/mid-level-api/script");

async function main() {
  const agreementId = "fc2b499a50dc2d48cfbb7031f0f06001590cf62131e2d79aac9f3e7ee6a7e993";
  const activityFactory = new ActivityFactory();
  console.log("Creating activity...");
  const activity = await activityFactory.create(agreementId);
  console.log("Activity ID:", activity.id);

  const command1 = new Deploy();
  const command2 = new Start();
  const capture = {
    stdout: { stream: { format: "string" } },
    stderr: { stream: { format: "string" } },
  };
  const command3 = new Run("/bin/sh", ["-c", 'echo "test"'], null, capture);
  const command4 = new Terminate();

  const script = new Script([command1, command2, command3, command4]);
  await script.before();
  const results = await activity.execute(script.getExeScriptRequest(), true, 10000);

  results.on("data", (result) =>
    console.log(`command #${result.index}`, "result:", result.result, "stdout: ", result.stdout)
  );

  results.on("error", (error) => console.error(error));

  results.on("end", async () => {
    await script.after();
    console.log("Script finished.");
    process.exit(1);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
