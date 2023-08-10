import { TaskExecutor } from "@golem-sdk/golem-js";
import { program } from "commander";

async function main(args) {
  const executor = await TaskExecutor.create({
    package: "055911c811e56da4d75ffc928361a78ed13077933ffa8320fb1ec2db",
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
    return parseInt(result.stdout || "");
  });

  if (!keyspace) throw new Error(`Cannot calculate keyspace`);
  const step = Math.floor(keyspace / args.numberOfProviders);
  const range = [...Array(Math.floor(keyspace / step)).keys()].map((i) => i * step);
  console.log(`Keyspace size computed. Keyspace size = ${keyspace}. Tasks to compute = ${range.length}`);

  const results = executor.map(range, async (ctx, skip) => {
    const results = await ctx
      .beginBatch()
      .run(
        `hashcat -a 3 -m 400 '${args.hash}' '${args.mask}' --skip=${skip} --limit=${
          skip! + step
        } -o pass.potfile || true`,
      )
      .run("cat pass.potfile || true")
      .end();
    if (!results?.[1]?.stdout) return false;
    return results?.[1]?.stdout.split(":")[1];
  });

  let password = "";
  for await (const result of results) {
    if (result) {
      password = result;
      break;
    }
  }
  if (!password) console.log("No password found");
  else console.log(`Password found: ${password}`);
  await executor.end();
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
