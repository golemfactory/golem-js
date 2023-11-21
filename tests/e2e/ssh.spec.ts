import { LoggerMock } from "../mock";
import crypto from "crypto";
import { TaskExecutor } from "../../src";
import { spawn } from "child_process";
const logger = new LoggerMock(false);

describe("SSH connection", function () {
  let executor: TaskExecutor;
  it("should connect to provider via ssh", async () => {
    executor = await TaskExecutor.create({
      package: "golem/examples-ssh:latest",
      capabilities: ["vpn"],
      networkIp: "192.168.0.0/24",
      logger,
    });
    let websocketUri;
    const password = crypto.randomBytes(3).toString("hex");
    let stdout = "";
    let processSsh;
    await executor.run(async (ctx) => {
      websocketUri = ctx.getWebsocketUri(22);
      const results = await ctx
        .beginBatch()
        .run("syslogd")
        .run("ssh-keygen -A")
        .run(`echo -e "${password}\n${password}" | passwd`)
        .run("/usr/sbin/sshd")
        .end()
        .catch((error) => console.error(error));
      expect(results?.[3]?.result).toEqual("Ok");
      expect(websocketUri).toEqual(expect.any(String));
      processSsh = spawn(
        `sshpass -p ${password} ssh`,
        [
          "-o",
          "UserKnownHostsFile=/dev/null",
          "-o",
          "StrictHostKeyChecking=no",
          "-o",
          `ProxyCommand='websocat asyncstdio: ${websocketUri} --binary -H=Authorization:"Bearer ${process.env.YAGNA_APPKEY}"'`,
          `root@${crypto.randomBytes(10).toString("hex")}`,
          "uname -v",
        ],
        { shell: true },
      );
      processSsh.stdout.on("data", (data) => (stdout += data.toString()));
    });
    await new Promise((res) => setTimeout(res, 3000));
    expect(stdout).toContain("1-Alpine SMP");
    processSsh.kill();
    await executor.end();
  });
});
