import fs from "fs";
import path from "path";
import { Executor, Task, utils, vm, WorkContext } from "yajsapi";
import { program } from "commander";

const { asyncWith, logger, range } = utils;

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
  for (let r of ranges) {
    const filePath = path.join(__dirname, `hashcat_${r}.potfile`);
    if (!fs.existsSync(filePath)) continue;
    const line = fs.readFileSync(filePath, {
      encoding: "utf8",
      flag: "r",
    });
    const split_list = line.split(":");
    if (split_list.length >= 2) return split_list[1];
  }
  return null;
}

async function main(args) {
  const _package = await vm.repo({
    image_hash: "055911c811e56da4d75ffc928361a78ed13077933ffa8320fb1ec2db",
    min_mem_gib: 0.5,
    min_storage_gib: 2.0,
  });
  let step;

  async function* worker_check_keyspace(ctx: WorkContext, tasks) {
    for await (let task of tasks) {
      const keyspace_sh_filename = "keyspace.sh";
      ctx.send_file(
        path.join(__dirname, keyspace_sh_filename),
        "/golem/input/keyspace.sh"
      );
      ctx.run("/bin/sh", ["/golem/input/keyspace.sh"]);
      const output_file = path.join(__dirname, "keyspace.txt");
      ctx.download_file("/golem/output/keyspace.txt", output_file);
      yield ctx.commit();
      task.accept_result();
    }
  }

  async function* worker_find_password(ctx: WorkContext, tasks) {
    ctx.send_file(path.join(__dirname, "in.hash"), "/golem/input/in.hash");
    for await (let task of tasks) {
      let skip = task.data();
      let limit = skip + step;
      // Commands to be run on the provider
      const commands = `touch /golem/output/hashcat_${skip}.potfile;
        hashcat -a 3 -m 400 /golem/input/in.hash ${args.mask} --skip=${skip} --limit=${limit} --self-test-disable -o /golem/output/hashcat_${skip}.potfile || true`;
      ctx.run("/bin/sh", ["-c", commands]);

      let output_file = path.join(__dirname, `hashcat_${skip}.potfile`);
      ctx.download_file(`/golem/output/hashcat_${skip}.potfile`, output_file);

      yield ctx.commit();
      task.accept_result(output_file);
    }
  }

  // beginning of the main flow
  write_hash(args.hash);
  write_keyspace_check_script(args.mask);

  await asyncWith(
    await new Executor({
      task_package: _package,
      max_workers: args.numberOfProviders,
      budget: "10.0",
      subnet_tag: args.subnetTag,
    }),
    async (executor: Executor): Promise<void> => {
      let keyspace_computed = false;
      // This is not a typical use of executor.submit as there is only one task, with no data:
      for await (let task of executor.submit(worker_check_keyspace, [new Task(null as any)])) {
        keyspace_computed = true;
      }
      // Assume the errors have been already reported and we may return quietly.
      if (!keyspace_computed) return;

      const keyspace = read_keyspace();
      logger.info(`Keyspace size computed. Keyspace size = ${keyspace}.`);
      step = Math.floor(keyspace / args.numberOfProviders + 1);
      const ranges = range(0, keyspace, parseInt(step));
      for await (let task of executor.submit(
        worker_find_password,
        ranges.map((range) => new Task(range as any))
      )) {
        logger.info(`result=${task.result()}`);
      }

      const password = read_password(ranges);

      if (!password) logger.info("No password found");
      else logger.info(`Password found: ${password}`);
    }
  );
  return;
}

program
  .option("--subnet-tag <subnet>", "set subnet name", "devnet-beta.2")
  .option("-d, --debug", "output extra debugging")
  .option(
    "--number-of-providers <number_of_providers>",
    "number of providers",
    (value) => parseInt(value),
    3
  )
  .option("--mask <mask>")
  .option("--hash <hash>");

program.parse(process.argv);
if (program.debug) {
  utils.changeLogLevel("debug");
}
logger.info(`Using subnet: ${program.subnetTag}`);
main(program);
