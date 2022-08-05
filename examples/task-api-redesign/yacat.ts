import fs from "fs";
import path from "path";
import { program } from "commander";
import { Task, Golem, range, logger } from "./todo";

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

function read_keyspace() {
  const filePath = path.join(__dirname, "keyspace.txt");
  const data = fs.readFileSync(filePath, { encoding: "utf8", flag: "r" });
  return parseInt(data);
}

function read_password(ranges) {
  for (const r of ranges) {
    const filePath = path.join(__dirname, `hashcat_${r}.potfile`);
    if (!fs.existsSync(filePath)) continue;
    const line = fs.readFileSync(filePath, {
      encoding: "utf8",
      flag: "r",
    });
    const split_list = line.trimRight().split(":");
    if (split_list.length >= 2) return split_list[1];
  }
  return null;
}

function make_attack_command(skip: number, limit: number, mask: string) {
  return (
    `touch /golem/output/hashcat_${skip}.potfile; ` +
    `hashcat -a 3 -m 400 /golem/input/in.hash ` +
    `${mask} --skip=${skip} --limit=${limit} ` +
    `--self-test-disable -o /golem/output/hashcat_${skip}.potfile || true`
  );
}

async function main(args) {
  write_hash(args.hash);
  write_keyspace_check_script(args.mask);

  const golem = new Golem("055911c811e56da4d75ffc928361a78ed13077933ffa8320fb1ec2db");
  const keyspace_computed = await golem.run(async (ctx) => {
    const result = await ctx
      .beginBatch()
      .sendFile(path.join(__dirname, "keyspace.sh"), "/golem/input/keyspace.sh")
      .run("/bin/sh", ["/golem/input/keyspace.sh"])
      .downloadFile("/golem/output/keyspace.txt", path.join(__dirname, "keyspace.txt"))
      .end();
    if (result.result === "ok") {
      ctx.acceptResult();
      return true;
    }
    ctx.rejectResult();
  });

  if (!keyspace_computed) {
    throw new Error(`Cannot calculate keyspace`);
  }
  const keyspace = read_keyspace();
  logger.info(`Keyspace size computed. Keyspace size = ${keyspace}.`);
  const step = Math.floor(keyspace / args.numberOfProviders + 1);
  const ranges = range(0, keyspace, parseInt(step));

  await golem.beforeEach((ctx) => ctx.sendFile(path.join(__dirname, "in.hash"), "/golem/input/in.hash"));

  await golem.map(ranges, async (ctx, skip) => {
    const result = await ctx
      .beginBatch()
      .sendFile(path.join(__dirname, "in.hash"), "/golem/input/in.hash")
      .run("/bin/sh", ["-c", make_attack_command(skip, skip + step, args.mask)])
      .downloadFile(`/golem/output/hashcat_${skip}.potfile`, path.join(__dirname, `hashcat_${skip}.potfile`))
      .end();
    console.log(`result=${result.stdout}`);
    ctx.acceptResult(result);
  });

  const password = read_password(ranges);
  if (!password) logger.info("No password found");
  else logger.info(`Password found: ${password}`);
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
main(program.opts());
