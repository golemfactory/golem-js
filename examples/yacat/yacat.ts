import { createExecutor, utils } from "../../dist";
import { program } from "commander";

async function main(args) {
  const executor = await createExecutor({
    package: "055911c811e56da4d75ffc928361a78ed13077933ffa8320fb1ec2db",
    maxWorkers: args.numberOfProviders,
    budget: 10,
    subnetTag: args.subnetTag,
    payment: { driver: args.paymentDriver, network: args.paymentNetwork },
    logLevel: args.debug ? "debug" : "info",
  });
  const keyspace = await executor.run<number>(async (ctx) => {
    const result = await ctx.run(`hashcat --keyspace -a 3 ${args.mask} -m 400`);
    return parseInt(result.stdout || "");
  });

  if (!keyspace) throw new Error(`Cannot calculate keyspace`);
  console.log(`Keyspace size computed. Keyspace size = ${keyspace}.`);
  const step = Math.floor(keyspace / args.numberOfProviders + 1);
  const ranges = utils.range(0, keyspace, step);

  const results = executor.map(ranges, async (ctx, skip) => {
    const results = await ctx
      .beginBatch()
      .run(`hashcat -a 3 -m 400 '${args.hash}' '${args.mask}' --skip=${skip} --limit=${skip + step} -o pass.potfile`)
      .run("cat pass.potfile")
      .end()
      .catch((err) => console.error(err));
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
  .option("--subnet-tag <subnet>", "set subnet name, for example 'devnet-beta'")
  .option("--payment-driver, --driver <driver>", "payment driver name, for example 'erc20'")
  .option("--payment-network, --network <network>", "network name, for example 'rinkeby'")
  .option("-d, --debug", "output extra debugging")
  .option("--number-of-providers <number_of_providers>", "number of providers", (value) => parseInt(value), 3)
  .option("--mask <mask>")
  .requiredOption("--hash <hash>");
program.parse();
const options = program.opts();
main(options).catch((e) => console.error(e));
