import { createGolem, utils } from "../../dist";
import path from "path";
import fs from "fs";
import { program } from "commander";
const logger = utils.logger;

function write_hash(hash) {
  const filePath = path.join(__dirname, "in.hash");
  fs.writeFile(filePath, hash, (error) => {
    if (error) logger.error(error);
  });
}

function write_keyspace_check_script(mask) {
  const command = `hashcat --keyspace -a 3 ${mask} -m 400 > /golem/output/keyspace.txt`;
  const filePath = path.join(__dirname, "keyspace.sh");
  fs.writeFile(filePath, command, (error) => {
    if (error) logger.error(error);
  });
}

function make_attack_command(skip: number | undefined, limit: number | undefined, mask: string) {
  return (
    `touch /golem/output/hashcat_${skip}.potfile; ` +
    `hashcat -a 3 -m 400 /golem/input/in.hash ` +
    `${mask} --skip=${skip} --limit=${limit} ` +
    `--self-test-disable || true`
  );
}

async function main(args) {
  write_hash(args.hash);
  write_keyspace_check_script(args.mask);

  const golem = await createGolem("055911c811e56da4d75ffc928361a78ed13077933ffa8320fb1ec2db");
  const keyspace = await golem.run<number>(async (ctx) => {
    const result = await ctx.run(`hashcat --keyspace -a 3 ${args.mask} -m 400`);
    return parseInt(result.stdout || "");
  });

  if (!keyspace) throw new Error(`Cannot calculate keyspace`);
  logger.info(`Keyspace size computed. Keyspace size = ${keyspace}.`);
  const step = Math.floor(keyspace / args.numberOfProviders + 1);
  const ranges = utils.range(0, keyspace, step);

  const results = golem.map(ranges, async (ctx, skip) => {
    const result = await ctx.run(
      `hashcat -a 3 -m 400 "${args.hash}" "${args.mask}" --skip=${skip} --limit=${skip + step} --self-test-disable`
    );
    console.log("xxx", result.stdout);
    return results;
  });

  for await (const result of results) {
    console.log(result);
  }

  const password = false;
  if (!password) logger.info("No password found");
  else logger.info(`Password found: ${password}`);
  await golem.end();
}

program
  .option("--subnet-tag <subnet>", "set subnet name, for example 'devnet-beta'")
  .option("--payment-driver, --driver <driver>", "payment driver name, for example 'erc20'")
  .option("--payment-network, --network <network>", "network name, for example 'rinkeby'")
  .option("-d, --debug", "output extra debugging")
  .option("--number-of-providers <number_of_providers>", "number of providers", (value) => parseInt(value), 3)
  .option("--mask <mask>")
  .option("--hash <hash>");

program.parse(process.argv);
main(program.opts()).catch((e) => console.error(e));
