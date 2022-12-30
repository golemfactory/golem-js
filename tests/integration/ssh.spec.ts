import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { createExecutor } from "../../yajsapi";
import { LoggerMock } from "../mock";
chai.use(chaiAsPromised);
const expect = chai.expect;
const logger = new LoggerMock(false);
import crypto from "crypto";
import { spawn } from "child_process";
import { TaskExecutor } from "../../yajsapi/executor";

describe("SSH connection", function () {
  let executor: TaskExecutor;
  afterEach(async function () {
    this.timeout(60000);
    await executor.end();
  });
  // TODO
  const sshConnectionCheck = true;
  it("should connect to provider via ssh", async () => {
    executor = await createExecutor({
      package: "1e06505997e8bd1b9e1a00bd10d255fc6a390905e4d6840a22a79902",
      capabilities: ["vpn"],
      networkAddress: "192.168.0.0/24",
      logger,
    });
    let websocketUri;
    const password = crypto.randomBytes(3).toString("hex");
    let error = "",
      stdout = "";
    await executor.run(async (ctx) => {
      websocketUri = ctx.getWebsocketUri(22);
      const results = await ctx
        .beginBatch()
        .run("syslogd")
        .run("ssh-keygen -A")
        .run(`echo -e "${password}\n${password}" | passwd`)
        .run("/usr/sbin/sshd")
        .end()
        .catch((e) => console.error(e));
      expect(results?.[3]?.result).to.equal("Ok");
      expect(websocketUri).to.an("string");
      if (sshConnectionCheck) {
        await new Promise((res) => setTimeout(res, 5000));
        const processSsh = spawn("ssh", [
          "-o",
          "UserKnownHostsFile=/dev/null",
          "-o",
          "StrictHostKeyChecking=no",
          "-o",
          `ProxyCommand='/usr/local/bin/websocat --binary -H=Authorization:"Bearer ${process.env.YAGNA_APPKEY}" asyncstdio: ${websocketUri}'`,
          `root@${crypto.randomBytes(10).toString("hex")}`,
          "uname -v",
        ]);
        processSsh.stdout?.setEncoding("utf-8");
        processSsh.stderr?.setEncoding("utf-8");
        processSsh.stdout.on("data", (data) => (stdout += data));
        processSsh.stderr.on("data", (data) => (error += data));
        processSsh.on("error", (data) => (error += data.toString()));
        processSsh.stdin?.write(password);
        processSsh.stdin?.end();
        await new Promise((res) => setTimeout(res, 2000));
      }
    });
    expect(error).to.equal("");
    if (sshConnectionCheck) expect(stdout).to.include("1-Alpine SMP");
  }).timeout(180000);
});
