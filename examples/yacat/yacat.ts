import fs from "fs";
import path from "path";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Engine, Task, utils, vm, WorkContext } from "../../yajsapi";
import { program } from "commander";

dayjs.extend(duration);

const { asyncWith, logger, range } = utils;

function write_hash(hash) {
  const filePath = path.join(__dirname, "in.hash");
  fs.writeFile(filePath, hash, (error) => {
    if (error) logger.error(error);
  });
}

function write_keyspace_check_script(mask) {
  const command = `hashcat --keyspace -a 3 ${mask} -m 400 > /golem/work/keyspace.txt`;
  const filePath = path.join(__dirname, "keyspace.sh");
  fs.writeFile(filePath, command, (error) => {
    if (error) logger.error(error);
  });
}

function read_keyspace() {
  const filePath = path.join(__dirname, "keyspace.txt");
  const data = fs.readFileSync(filePath, { encoding: "utf8", flag: "r" });
  return data;
}

function read_password(ranges) {
  for (let r of ranges) {
    const filePath = path.join(__dirname, `hashcat_${r}.potfile`);
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
  const _package = await vm.repo(
    "2c17589f1651baff9b82aa431850e296455777be265c2c5446c902e9",
    0.5,
    2.0
  );
  let step;

  async function* worker_check_keyspace(ctx: WorkContext, tasks) {
    for await (let task of tasks) {
      let keyspace_sh_filename = "keyspace.sh";
      ctx.send_file(
        path.join(__dirname, `./${keyspace_sh_filename}`),
        "/golem/work/keyspace.sh"
      );
      ctx.run("/bin/sh", "/golem/work/keyspace.sh");
      const output_file = path.join(__dirname, "keyspace.txt");
      ctx.download_file("/golem/work/keyspace.txt", output_file);
      yield ctx.commit();
      task.accept_result();
    }
  }

  async function* worker_find_password(ctx: WorkContext, tasks) {
    ctx.send_file(path.join(__dirname, "./in.hash"), "/golem/work/in.hash");
    for await (let task of tasks) {
      let skip = task.data();
      let limit = skip + step;
      // Commands to be run on the provider
      const commands = `touch /golem/work/hashcat.potfile; 
        hashcat -a 3 -m 400 /golem/work/in.hash --skip=${skip} --limit=${limit} ${args.mask} -o /golem/work/hashcat.potfile --self-test-disable`;
      ctx.run("/bin/sh", ["-c", commands]);

      let output_file = `hashcat_${skip}.potfile`;
      ctx.download_file("/golem/work/hashcat.potfile", output_file);

      yield ctx.commit();
      task.accept_result(output_file);
    }
  }

  // beginning of the main flow
  write_hash(args.hash);
  write_keyspace_check_script(args.mask);

  const timeout = dayjs.duration({ minutes: 35 }).asMilliseconds();

  await asyncWith(
    await new Engine(
      _package,
      6,
      timeout, //5 min to 30 min
      "10.0",
      undefined,
      args.subnetTag,
      (event) => {
        console.debug(event);
      }
    ),
    async (engine: Engine): Promise<void> => {
      // This is not a typical use of executor.submit as there is only one task, with no data:
      for await (let task of engine.map(worker_check_keyspace, [
        new Task(null as any),
      ]))
        null;

      const keyspace = read_keyspace();
      const ranges = range(0, parseInt(keyspace), step);

      step = parseInt(keyspace) / args.number_of_providers + 1;

      for await (let task of engine.map(
        worker_find_password,
        ranges.map((range) => new Task(range as any))
      )) {
        console.log("result=", task.output());
      }

      const password = read_password(ranges);

      if (!password) logger.info("No password found");
      else logger.info(`PASSWORD FOUND! ${password}`);
    }
  );
  return;
}

program
  .option("--subnet-tag <subnet>", "set subnet name", "community.3")
  .option("-d, --debug", "output extra debugging")
  .option(
    "--number-of-providers <number_of_providers>",
    "Number of profiders",
    (value) => parseInt(value),
    3
  )
  .option("--mask <mask>")
  .option("--hash <hash>");

program.parse(process.argv);
if (program.debug) {
  utils.changeLogLevel("debug");
}
console.log(`Using subnet: ${program.subnetTag}`);
main(program);
