const { Executor, Task, utils: { asyncWith, sleep }, vm } = require("../../dist");
const crypto = require("crypto");

async function main() {
  const SESSION_TIMEOUT = 5 * 60; // 5 min
  const SESSION_COUNT = 3;
  const package = await vm.repo({
    image_hash: "1e06505997e8bd1b9e1a00bd10d255fc6a390905e4d6840a22a79902",
    capabilities: ['vpn']
  });
  const tasks = new Array(SESSION_COUNT).fill(new Task(null));

  async function* worker(context, tasks) {
    const password = '12345';
    const connection_uri = context.network_node.get_websocket_uri(22);
    const app_key = process.env["YAGNA_APPKEY"];

    console.log("\n------------------------------------------");
    console.log(`Connect via ssh to provider "${context.provider_info.provider_name}"`);
    console.log(`Connect with:\nssh -o ProxyCommand='websocat asyncstdio: ${connection_uri} --binary -H=Authorization:\"Bearer ${app_key}\"' root@${crypto.randomBytes(10).toString('hex')}`);
    console.log(`Password: ${password}`);
    console.log("------------------------------------------\n");

    for await (let task of tasks) {
      context.run("/bin/bash", ["-c", "syslogd"]);
      context.run("/bin/bash", ["-c", "ssh-keygen -A"]);
      context.run("/bin/bash", ["-c", `echo -e "${password}\n${password}" | passwd`]);
      context.run("/bin/bash", ["-c", "/usr/sbin/sshd"]);
      const future_result = yield context.commit();
      const { results } = await future_result;
      if (results[results.length - 1]?.success) {
        await sleep(SESSION_TIMEOUT);
        task.accept_result();
      } else {
        task.reject_result();
      }
    }
  }

  await asyncWith(
    new Executor({
      task_package: package,
      budget: "1.0",
      subnet_tag: "devnet-beta",
      network_address: "192.168.0.0/24",
      max_workers: SESSION_COUNT
    }),
    async (executor) => {
      for await (let completed of executor.submit(worker, tasks)) {
        console.log(`Task ${completed.id} completed.`);
      }
    }
  );
}

main();
