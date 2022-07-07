const { ActivityFactory } = require("../../dist/mid-level-api/activity");
const { Deploy, Start, Run, Terminate, SendFile, DownloadFile, Script } = require("../../dist/mid-level-api/script");
const { GftpStorageProvider } = require("../../dist/mid-level-api/storage/gftp_provider");
const fs = require("fs");
const path = require("path");

async function main() {
  const agreementId = "a5f63b3d0d066d7e94ea60bad9e87eaea9c1067feb1165c2facb8f8fa49a0659";
  const activityFactory = new ActivityFactory();
  const activity = await activityFactory.create(agreementId);
  const storageProvider = new GftpStorageProvider();

  const command1 = new Deploy();
  const command2 = new Start();
  const command3 = new SendFile(storageProvider, path.join(__dirname, "file.txt"), "/golem/resource/file.txt");
  const command4 = new Run("/bin/sh", ["-c", "cat /golem/resource/file.txt"]);
  const command5 = new Run("/bin/sh", ["-c", "echo '\nHello World!' >> /golem/resource/file.txt"]);
  const command6 = new DownloadFile(storageProvider, "/golem/resource/file.txt", path.join(__dirname, "new_file.txt"));
  const command7 = new Terminate();

  const script = new Script([command1, command2, command3, command4, command5, command6, command7]);
  await script.before();
  const results = await activity.execute(script.getExeScriptRequest());

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
