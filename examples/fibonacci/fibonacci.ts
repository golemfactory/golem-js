import { TaskExecutor } from "@golem-sdk/golem-js";
import { program } from "commander";

type MainOptions = {
  subnetTag: string;
  paymentDriver: string;
  paymentNetwork: string;
  tasksCount: number;
  fibonacciNumber: number;
};

program
  .option("-n, --fibonacci-number <n>", "fibonacci number", "1")
  .option("-c, --tasks-count <c>", "tasks count", "1")
  .option("--subnet-tag <subnet>", "set subnet name, for example 'public'", "public")
  .option("--payment-driver, --driver <driver>", "payment driver name, for example 'erc20'", "erc20")
  .option("--payment-network, --network <network>", "network name, for example 'holesky'", "holesky")
  .action(async (options: MainOptions) => {
    const executor = await TaskExecutor.create({
      package: "golem/js-fibonacci:latest",
      subnetTag: options.subnetTag,
      payment: { driver: options.paymentDriver, network: options.paymentNetwork },
    });

    const runningTasks: Promise<string | undefined>[] = [];
    for (let i = 0; i < options.tasksCount; i++) {
      runningTasks.push(
        executor.run(async (ctx) => {
          const result = await ctx.run("/usr/local/bin/node", [
            "/golem/work/fibo.js",
            options.fibonacciNumber.toString(),
          ]);
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
  });

program.parse();
