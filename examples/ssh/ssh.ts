import { createExecutor, utils } from "../../dist";
import crypto from "crypto";
import { program } from "commander";

async function main(subnetTag, driver, network, count = 2, session_timeout = 10, debug) {
  const executor = await createExecutor({
    package: "1e06505997e8bd1b9e1a00bd10d255fc6a390905e4d6840a22a79902",
    capabilities: ["vpn"],
    networkAddress: "192.168.0.0/24",
    maxParallelTasks: count,
    subnetTag,
    payment: { driver, network },
    logLevel: debug ? "debug" : "info",
  });
  const data = new Array(count).fill(null);
  const app_key = process.env["YAGNA_APPKEY"];
  await executor.forEach(data, async (ctx) => {
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
    console.log(`Connect via ssh to provider "todo" with:`);
    console.log(
      `ssh -o ProxyCommand='websocat asyncstdio: ${ctx.getWebsocketUri(
        22
      )} --binary -H=Authorization:"Bearer ${app_key}"' root@${crypto.randomBytes(10).toString("hex")}`
    );
    console.log(`Password: ${password}`);
    console.log("------------------------------------------\n");
    await utils.sleep(session_timeout);
    console.log(`Task completed. Session SSH closed after ${session_timeout} secs timeout.`);
  });
  await executor.end();
}

program
  .option("--subnet-tag <subnet>", "set subnet name, for example 'public'")
  .option("--payment-driver <payment_driver>", "payment driver name, for example 'erc20'")
  .option("--payment-network <payment_network>", "network name, for example 'rinkeby'")
  .option("--task-count, --count <count>", "task count", (val) => parseInt(val))
  .option("-t, --timeout <timeout>", "ssh session timeout (in seconds)", (val) => parseInt(val))
  .option("-d, --debug", "output extra debugging");
program.parse();
const options = program.opts();
main(options.subnetTag, options.payment_driver, options.payment_network, options.count, options.timeout, options.debug);
