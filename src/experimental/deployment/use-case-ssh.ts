import crypto from "crypto";
import { GolemDeploymentBuilder } from "./deployment-builder";

async function main(subnetTag: string, driver: string, network: string, count = 2, sessionTimeout = 100, debug = true) {
  const deployment = new GolemDeploymentBuilder()
    .createService("worker", {
      image: "golem/worker:latest",
      maxReplicas: count,
      minReplicas: count,
    })
    .createNetwork("network", {})
    .addServiceToNetwork("worker", "network")
    .build();

  const appKey = process.env["YAGNA_APPKEY"];

  const runningTasks: Promise<void>[] = [];
  for (let i = 0; i < count; i++) {
    const activity = await deployment.service("worker").acquire();

    runningTasks.push(
      activity.work(async (ctx) => {
        const password = crypto.randomBytes(3).toString("hex");
        try {
          await ctx.run("syslogd");
          await ctx.run("ssh-keygen", ["-A"]);
          await ctx.run(`echo -e "${password}\n${password}" | passwd`);
          await ctx.run("/usr/sbin/sshd");

          console.log("\n------------------------------------------");
          console.log(`Connect via ssh to provider "${activity.info.provider?.name}" with:`);
          console.log(
            `ssh -o ProxyCommand='websocat asyncstdio: ${activity.getWebsocketUrl(
              22,
            )} --binary -H=Authorization:"Bearer ${appKey}"' root@${crypto.randomBytes(10).toString("hex")}`,
          );
          console.log(`Password: ${password}`);
          console.log("------------------------------------------\n");
          await new Promise((res) => setTimeout(res, sessionTimeout * 1000));
          console.log(`Task completed. Session SSH closed after ${sessionTimeout} secs timeout.`);
        } catch (error) {
          console.error("Computation failed:", error);
        }
      }),
    );
  }

  try {
    await Promise.allSettled(runningTasks);
  } finally {
    await deployment.stop();
  }
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
