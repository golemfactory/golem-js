const { ActivityFactory } = require("../../dist/mid-level-api/activity");
const { Run, Start, Deploy, Terminate } = require("../../dist/mid-level-api/script");

async function main() {
  const agreementId = "769d892c72f10ca4e3df3afd96178d90edd6f5acca74bfd0a52f4aecbcecb707";
  const activityFactory = new ActivityFactory();
  const activity = await activityFactory.create(agreementId);

  await activity.execute([new Deploy().toJson()]);
  await activity.execute([new Start().toJson()]);
  const commandRun = new Run("/bin/sh", ["-c", "echo 'Hello World'"]);
  const commandRunResult = await activity.execute([commandRun.toJson()]);
  console.log("RESULTS: ", commandRunResult.read());
  await activity.execute([new Terminate().toJson()]);
  await activity.stop();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
