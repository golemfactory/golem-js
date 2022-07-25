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

  const golem = new Golem({
    package: {
      image_hash: "055911c811e56da4d75ffc928361a78ed13077933ffa8320fb1ec2db",
    },
    max_workers: args.numberOfProviders,
    budget: "10.0",
    subnet_tag: args.subnetTag,
    driver: args.driver,
    network: args.network,
  });
  const keyspace_computed = await golem.run(async (ctx, task) => {
    ctx.send_file(path.join(__dirname, "keyspace.sh"), "/golem/input/keyspace.sh");
    ctx.run("/bin/sh", ["/golem/input/keyspace.sh"]);
    ctx.download_file("/golem/output/keyspace.txt", path.join(__dirname, "keyspace.txt"));
    const result = await ctx.commit();
    if (result.result === "ok") {
      task.accept_result();
      return true;
    }
    task.reject_result();
  });

  if (!keyspace_computed) {
    throw new Error(`Cannot calculate keyspace`);
  }
  const keyspace = read_keyspace();
  logger.info(`Keyspace size computed. Keyspace size = ${keyspace}.`);
  const step = Math.floor(keyspace / args.numberOfProviders + 1);
  const ranges = range(0, keyspace, parseInt(step));
  const tasks = ranges.map((range) => new Task(range));

  await golem.init(async (ctx) => {
    ctx.send_file(path.join(__dirname, "in.hash"), "/golem/input/in.hash");
    await ctx.commit();
  });

  await golem.map(tasks, async (ctx, task) => {
    const skip = task.data();
    ctx.send_file(path.join(__dirname, "in.hash"), "/golem/input/in.hash");
    ctx.run("/bin/sh", ["-c", make_attack_command(skip, skip + step, args.mask)]);
    ctx.download_file(`/golem/output/hashcat_${skip}.potfile`, path.join(__dirname, `hashcat_${skip}.potfile`));

    const result = await ctx.commit();
    task.accept_result(result);
    console.log(`result=${result.stdout}`);
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
