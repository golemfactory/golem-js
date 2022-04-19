const { Executor, Task, utils, vm } = require("yajsapi");
const { asyncWith, sleep } = utils;
const crypto = require("crypto");
const { program } = require("commander");

async function main(subnetTag, payment_driver, payment_network, count = 2, session_timeout = 60) {
  const _package = await vm.repo({
    // this hash points to an image built from the Dockerfile in this directory.
    image_hash: "1e06505997e8bd1b9e1a00bd10d255fc6a390905e4d6840a22a79902",
    capabilities: ["vpn"],
  });
  const tasks = new Array(count).fill(null).map(() => new Task(null));
  const app_key = process.env["YAGNA_APPKEY"];

  async function* worker(context, tasks) {
    for await (let task of tasks) {
      const password = crypto.randomBytes(3).toString("hex");
      context.run("/bin/bash", ["-c", "syslogd"]);
      context.run("/bin/bash", ["-c", "ssh-keygen -A"]);
      context.run("/bin/bash", ["-c", `echo -e "${password}\n${password}" | passwd`]);
      context.run("/bin/bash", ["-c", "/usr/sbin/sshd"]);
      const future_result = yield context.commit();
      const { results } = await future_result;
      if (results[results.length - 1].success) {
        const connection_uri = context.network_node.get_websocket_uri(22);
        console.log("\n------------------------------------------");
        console.log(`Connect via ssh to provider "${context.provider_info.provider_name}" with:`);
        console.log(
          `ssh -o ProxyCommand='websocat asyncstdio: ${connection_uri} --binary -H=Authorization:"Bearer ${app_key}"' root@${crypto
            .randomBytes(10)
            .toString("hex")}`
        );
        console.log(`Password: ${password}`);
        console.log("------------------------------------------\n");
        await sleep(session_timeout);
        task.accept_result();
      } else {
        task.reject_result();
      }
    }
  }

  const executor = new Executor({
    task_package: _package,
    budget: "1.0",
    subnet_tag: subnetTag,
    payment_driver,
    payment_network,
    network_address: "192.168.0.0/24",
    max_workers: count,
  });
  await executor.run(async (executor) => {
    for await (let completed of executor.submit(worker, tasks)) {
      console.log(`Task ${completed.id} completed. Session SSH closed after ${session_timeout} secs timeout.`);
    }
  });
}

program
  .option("--subnet-tag <subnet>", "set subnet name, for example 'devnet-beta'")
  .option("--payment-driver <payment_driver>", "payment driver name, for example 'erc20'")
  .option("--payment-network <payment_network>", "network name, for example 'rinkeby'")
  .option("--task-count, --count <count>", "task count", (val) => parseInt(val))
  .option("--session-timeout, --timeout <timeout>", "ssh session timeout (in seconds)", (val) => parseInt(val))
  .option("-d, --debug", "output extra debugging");
program.parse();
const options = program.opts();
if (options.debug) {
  utils.changeLogLevel("debug");
}
main(options.subnetTag, options.payment_driver, options.payment_network, options.count, options.timeout);
