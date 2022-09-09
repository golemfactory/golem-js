const { createExecutor, utils } = require("../../dist");
const { program } = require("commander");

async function main(fibo_n = 1, tasks_count = 1, subnet_tag, payment_driver, payment_network) {
  const executor = await createExecutor({
    package: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
    subnet_tag,
    payment_driver,
    payment_network,
  });

  const data = Array(tasks_count).fill(null);

  await executor.forEach(data, async (ctx) => {
    const result = await ctx.run("/usr/local/bin/node", ["/golem/work/fibo.js", fibo_n.toString()]);
    console.log(result.stdout);
  });
  await executor.end();
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
