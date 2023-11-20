import { TaskExecutor } from "@golem-sdk/golem-js";
import { program } from "commander";

async function main(args) {
  const executor = await TaskExecutor.create({
    package: "golem/examples-hashcat:latest",
    maxParallelTasks: args.numberOfProviders,
    minMemGib: 0.5,
    minStorageGib: 2,
    budget: 10,
    subnetTag: args.subnetTag,
    taskTimeout: 1000 * 60 * 8, // 8 min
    payment: { driver: args.paymentDriver, network: args.paymentNetwork },
    logLevel: args.debug ? "debug" : "info",
  });
  const keyspace = await executor.run<number>(async (ctx) => {
    const result = await ctx.run(`hashcat --keyspace -a 3 ${args.mask} -m 400`);
    return parseInt(result.stdout?.toString().trim() || "");
  });

  if (!keyspace) throw new Error(`Cannot calculate keyspace`);
  const step = Math.floor(keyspace / args.numberOfProviders);
  const range = [...Array(Math.floor(keyspace / step)).keys()].map((i) => i * step);
  console.log(`Keyspace size computed. Keyspace size = ${keyspace}. Tasks to compute = ${range.length}`);

  const findPasswordInRange = async (skip: number) => {
    const password = await executor.run(async (ctx) => {
      const [, potfileResult] = await ctx
        .beginBatch()
        .run(
          `hashcat -a 3 -m 400 '${args.hash}' '${args.mask}' --skip=${skip} --limit=${
            skip + step
          } -o pass.potfile || true`,
        )
        .run("cat pass.potfile || true")
        .end();
      if (!potfileResult.stdout) return false;
      // potfile format is: hash:password
      return potfileResult.stdout.toString().trim().split(":")[1];
    });
    if (!password) {
      throw new Error(`Cannot find password in range ${skip} - ${skip + step}`);
    }
    return password;
  };

  try {
    const password = await Promise.any(range.map(findPasswordInRange));
    console.log(`Password found: ${password}`);
  } catch (err) {
    console.log(`Password not found`);
  } finally {
    await executor.shutdown();
  }
}

program
  .option("--subnet-tag <subnet>", "set subnet name, for example 'public'")
  .option("--payment-driver, --driver <driver>", "payment driver name, for example 'erc20'")
  .option("--payment-network, --network <network>", "network name, for example 'goerli'")
  .option("-d, --debug", "output extra debugging")
  .option("--number-of-providers <number_of_providers>", "number of providers", (value) => parseInt(value), 2)
  .option("--mask <mask>")
  .requiredOption("--hash <hash>");
program.parse();
const options = program.opts();
main(options).catch((e) => console.error(e));
