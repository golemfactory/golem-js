const { ActivityFactory } = require("../../dist/mid-level-api/activity");
const { Deploy, Start, Run, Terminate, SendFile, DownloadFile, Script } = require("../../dist/mid-level-api/script");
const { OldStorageProviderFacade } = require("../../dist/mid-level-api/storage/old_provider");
const fs = require("fs");
const path = require("path");

async function main() {
  const agreementId = "aeff1b5ed99d878c999df0a83a74c874f6bdcd3e6f885d1d8a4ab19cb8512739";
  const activityFactory = new ActivityFactory();
  const activity = await activityFactory.create(agreementId);
  const storageProvider = new OldStorageProviderFacade();

  const command1 = new Deploy();
  const command2 = new Start();
  const command3 = new SendFile(storageProvider, path.join(__dirname, "file.txt"), "/golem/resource/file.txt");
  const command4 = new Run("/bin/sh", ["-c", "cat /golem/resource/file.txt"]);
  const command5 = new Run("/bin/sh", ["-c", "echo '\nHello World!' >> /golem/resource/file.txt"]);
  const command6 = new DownloadFile(storageProvider, "/golem/resource/file.txt", path.join(__dirname, "new_file.txt"));
  const command7 = new Terminate();

  const script = new Script([command1, command2, command3, command4, command5, command6, command7]);
  await script.before();
  const batchTxt = script.serialize();
  const results = await activity.execute(batchTxt);

  results.on("data", (result) =>
    console.log(`command #${result.index}`, "result:", result.result, "stdout: ", result.stdout)
  );

  results.on("end", async () => {
    await script.after();
    console.log("New file content: ", fs.readFileSync(path.join(__dirname, "new_file.txt"), "utf8"));
    process.exit(0);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
