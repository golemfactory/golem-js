const { Executor, Task, utils, vm } = require("yajsapi");
const { logUtils } = utils;
const { program } = require("commander");

async function main(fibo_n = 1, tasks_count = 1, subnet_tag, payment_driver, payment_network) {
  const task_package = await vm.repo({
    image_hash: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
  });
  const tasks = Array(tasks_count).fill(new Task({}));

  async function* worker(context, tasks) {
    for await (let task of tasks) {
      context.run("/usr/local/bin/node", ["/golem/work/fibo.js", fibo_n.toString()]);
      const future_result = yield context.commit();
      const { results } = await future_result;
      task.accept_result(results[results.length - 1]);
    }
  }

  const executor = new Executor({
    task_package,
    budget: "1",
    subnet_tag,
    payment_driver,
    payment_network,
    event_consumer: logUtils.logSummary(),
  });

  await executor.run(async (executor) => {
    for await (let completed of executor.submit(worker, tasks)) {
      console.log(completed.result().stdout);
    }
  });
}
program
  .requiredOption("-n, --fibonacci-number <n>", "fibonacci number", (val) => parseInt(val))
  .option("-c, --tasks-count <c>", "tasks count", (val) => parseInt(val))
  .option("--subnet-tag <subnet>", "set subnet name, for example 'devnet-beta'")
  .option("--payment-driver, --driver <driver>", "payment driver name, for example 'erc20'")
  .option("--payment-network, --network <network>", "network name, for example 'rinkeby'")
  .option("-d, --debug", "output extra debugging");
program.parse();
const options = program.opts();
if (options.debug) {
  utils.changeLogLevel("debug");
}
main(options.fibonacciNumber, options.tasksCount, options.subnetTag, options.driver, options.network);
