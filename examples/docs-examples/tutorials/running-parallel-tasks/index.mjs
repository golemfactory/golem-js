import { TaskExecutor } from "@golem-sdk/golem-js";
import { program } from "commander";

async function main(args) {
  const executor = await TaskExecutor.create({
    package: "055911c811e56da4d75ffc928361a78ed13077933ffa8320fb1ec2db",
    maxParallelTasks: args.numberOfProviders,
    yagnaOptions: { apiKey: `try_golem` },
  });

  const keyspace = await executor.run(async (ctx) => {
    const result = await ctx.run(`hashcat --keyspace -a 3 ${args.mask} -m 400`);
    return parseInt(result.stdout || "");
  });

  if (!keyspace) throw new Error(`Cannot calculate keyspace`);

  console.log(`Keyspace size computed. Keyspace size = ${keyspace}.`);
  const step = Math.floor(keyspace / args.numberOfProviders + 1);
  const range = [...Array(Math.floor(keyspace / step) + 1).keys()].map((i) => i * step);

  const findPasswordInRange = async (skip) => {
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
    await executor.end();
  }
}

program
  .option("--number-of-providers <number_of_providers>", "number of providers", (value) => parseInt(value), 3)
  .option("--mask <mask>")
  .requiredOption("--hash <hash>");
program.parse();
const options = program.opts();
main(options).catch((e) => console.error(e));
