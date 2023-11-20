import { TaskExecutor } from "@golem-sdk/golem-js";
import { program } from "commander";
import crypto from "crypto";

async function main(subnetTag, driver, network, count = 2, sessionTimeout = 100, debug) {
  const executor = await TaskExecutor.create({
    package: "golem/examples-ssh:latest",
    capabilities: ["vpn"],
    networkIp: "192.168.0.0/24",
    maxParallelTasks: count,
    subnetTag,
    payment: { driver, network },
    logLevel: debug ? "debug" : "info",
  });
  const appKey = process.env["YAGNA_APPKEY"];
  const runningTasks: Promise<void>[] = [];
  for (let i = 0; i < count; i++) {
    runningTasks.push(
      executor.run(async (ctx) => {
        const password = crypto.randomBytes(3).toString("hex");
        const results = await ctx
          .beginBatch()
          .run("syslogd")
          .run("ssh-keygen -A")
          .run(`echo -e "${password}\n${password}" | passwd`)
          .run("/usr/sbin/sshd")
          .end()
          .catch((e) => console.error(e));
        if (!results) return;
        console.log("\n------------------------------------------");
        console.log(`Connect via ssh to provider "${ctx.provider?.name}" with:`);
        console.log(
          `ssh -o ProxyCommand='websocat asyncstdio: ${ctx.getWebsocketUri(
            22,
          )} --binary -H=Authorization:"Bearer ${appKey}"' root@${crypto.randomBytes(10).toString("hex")}`,
        );
        console.log(`Password: ${password}`);
        console.log("------------------------------------------\n");
        await new Promise((res) => setTimeout(res, sessionTimeout * 1000));
        console.log(`Task completed. Session SSH closed after ${sessionTimeout} secs timeout.`);
      }),
    );
  }
  await Promise.all(runningTasks);
  await executor.shutdown();
}

program
  .option("--subnet-tag <subnet>", "set subnet name, for example 'public'")
  .option("--payment-driver <paymentDriver>", "payment driver name, for example 'erc20'")
  .option("--payment-network <paymentNetwork>", "network name, for example 'goerli'")
  .option("--task-count, --count <count>", "task count", (val) => parseInt(val))
  .option("-t, --timeout <timeout>", "ssh session timeout (in seconds)", (val) => parseInt(val))
  .option("-d, --debug", "output extra debugging");
program.parse();
const options = program.opts();
main(options.subnetTag, options.paymentDriver, options.paymentNetwork, options.count, options.timeout, options.debug);
