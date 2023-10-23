import { TaskExecutor } from "@golem-sdk/golem-js";
import { program } from "commander";

async function main(fiboN = 1, tasksCount = 1, subnetTag, driver, network, debug) {
  const executor = await TaskExecutor.create({
    package: "golem/js-fibonacci:latest",
    subnetTag,
    payment: { driver, network },
    logLevel: debug ? "debug" : "info",
  });

  const data = Array(tasksCount).fill(null);

  await executor.forEach(data, async (ctx) => {
    const result = await ctx.run("/usr/local/bin/node", ["/golem/work/fibo.js", fiboN.toString()]);
    console.log(result.stdout);
  });
  await executor.end();
}
program
  .requiredOption("-n, --fibonacci-number <n>", "fibonacci number", (val) => parseInt(val))
  .option("-c, --tasks-count <c>", "tasks count", (val) => parseInt(val))
  .option("--subnet-tag <subnet>", "set subnet name, for example 'public'")
  .option("--payment-driver, --driver <driver>", "payment driver name, for example 'erc20next'")
  .option("--payment-network, --network <network>", "network name, for example 'goerli'")
  .option("-d, --debug", "output extra debugging");
program.parse();
const options = program.opts();
main(options.fibonacciNumber, options.tasksCount, options.subnetTag, options.driver, options.network, options.debug);
