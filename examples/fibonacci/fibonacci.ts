import { TaskExecutor } from "@golem-sdk/golem-js";
import { program } from "commander";

async function main(subnetTag: string, driver: string, network: string, tasksCount = 1, fiboN = 1) {
  const executor = await TaskExecutor.create({
    package: "golem/js-fibonacci:latest",
    subnetTag,
    payment: { driver, network },
  });

  const runningTasks: Promise<string | undefined>[] = [];
  for (let i = 0; i < tasksCount; i++) {
    runningTasks.push(
      executor.run(async (ctx) => {
        const result = await ctx.run("/usr/local/bin/node", ["/golem/work/fibo.js", fiboN.toString()]);
        console.log(result.stdout);
        return result.stdout?.toString().trim();
      }),
    );
  }

  try {
    await Promise.all(runningTasks);
  } finally {
    await executor.shutdown();
  }
}

program
  .requiredOption("-n, --fibonacci-number <n>", "fibonacci number", (val) => parseInt(val))
  .option("-c, --tasks-count <c>", "tasks count", (val) => parseInt(val))
  .option("--subnet-tag <subnet>", "set subnet name, for example 'public'")
  .option("--payment-driver, --driver <driver>", "payment driver name, for example 'erc20'")
  .option("--payment-network, --network <network>", "network name, for example 'goerli'");

program.parse();

const options = program.opts();

main(options.subnetTag, options.driver, options.network, options.tasksCount, options.fibonacciNumber).catch((err) =>
  console.error("Error in main", err),
);
