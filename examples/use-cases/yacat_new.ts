import fs from "fs";
import path from "path";
import { program } from "commander";
import { Task, Package, Golem, range, logger } from "./todo";

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

  const _package = new Package({
    image_hash: "055911c811e56da4d75ffc928361a78ed13077933ffa8320fb1ec2db",
    min_mem_gib: 0.5,
    min_storage_gib: 2.0,
  });

  const golem = new Golem({
    package: _package,
    max_workers: args.numberOfProviders,
    budget: "10.0",
    subnet_tag: args.subnetTag,
    driver: args.driver,
    network: args.network,
  });

  await golem.init();

  const compute_keyspace_task = new Task();
  compute_keyspace_task.send_file(path.join(__dirname, "keyspace.sh"), "/golem/input/keyspace.sh");
  compute_keyspace_task.run("/bin/sh", ["/golem/input/keyspace.sh"]);
  compute_keyspace_task.download_file("/golem/output/keyspace.txt", path.join(__dirname, "keyspace.txt"));

  const result_compute_keyspace_task = await golem.runSync([compute_keyspace_task]);
  if (result_compute_keyspace_task.result !== "ok") {
    throw new Error(`Cannot calculate keyspace. ${result_compute_keyspace_task.error}`);
  }
  await golem.acceptTaskResult(result_compute_keyspace_task.task_id);
  const keyspace = read_keyspace();
  logger.info(`Keyspace size computed. Keyspace size = ${keyspace}.`);
  const step = Math.floor(keyspace / args.numberOfProviders + 1);
  const ranges = range(0, keyspace, +step);

  const tasks = ranges.map((skip) => {
    const limit = skip + step;
    const task = new Task();
    task.send_file(path.join(__dirname, "in.hash"), "/golem/input/in.hash");
    task.run("/bin/sh", ["-c", make_attack_command(skip, limit, args.mask)]);
    task.download_file(`/golem/output/hashcat_${skip}.potfile`, path.join(__dirname, `hashcat_${skip}.potfile`));
    return task;
  });

  const results = golem.run(tasks);

  // synchronous
  for await (const result of results) {
    if (result.result === "ok") {
      logger.info(`result=${result.stdout}`);
      await result.accept();
    }
  }

  // or asynchronous
  // results.on("data", async (result) => {
  //   if (result.result === "ok") {
  //     logger.info(`result=${result.stdout}`);
  //     await result.accept();
  //     // await golem.acceptTaskResult(result.task_id);
  //   } else {
  //     logger.error(`result=${result.error}`);
  //     await result.reject();
  //     // await golem.rejectTaskResult(result.task_id);
  //   }
  // });

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
