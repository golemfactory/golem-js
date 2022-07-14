async function main() {
  const agreementId = "946191f0af799328fa2c8fbab5bf52f23155d653fbde2e761e10caed16b537a4";
  const activityFactory = new ActivityFactory();
  const activity = await activityFactory.create(agreementId);

  const storageProvider = new GftpStorageProvider();

  const script = new Script(storageProvider);
  script.addCommand("deploy");
  script.addCommand("start");
  script.addCommand("run", { cmd: "/bin/sh", args: ["-c", 'date +"DATE1: %d-%m-%Y %H:%m:%S.%s"'] });
  script.addCommand("run", { cmd: "/bin/sh", args: ["-c", 'date +"DATE2: %d-%m-%Y %H:%m:%S.%s"'] });
  script.addCommand("run", { cmd: "/bin/sh", args: ["-c", 'date +"DATE3: %d-%m-%Y %H:%m:%S.%s"'] });
  script.addCommand("terminate");

  await script.before();
  const results = await activity.execute(script.getExeScriptRequest());

  for await (const result of results) {
    console.log(`command #${result.index}`, "result:", result.result, "stdout: ", result.stdout);
  }
  await script.after();
  console.log("Script finished.");
}
