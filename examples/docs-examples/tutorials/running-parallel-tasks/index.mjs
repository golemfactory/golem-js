import { TaskExecutor } from "@golem-sdk/golem-js";
import { program } from "commander";

async function main(args) {
  const executor = await TaskExecutor.create({
    package: "055911c811e56da4d75ffc928361a78ed13077933ffa8320fb1ec2db",
    maxParallelTasks: args.numberOfProviders,
    yagnaOptions: { apiKey: `try_golem` },
  });

  try {
    const keyspace = await executor.run(async (ctx) => {
      const result = await ctx.run(`hashcat --keyspace -a 3 ${args.mask} -m 400`);
      return parseInt(result.stdout || "");
    });

    if (!keyspace) throw new Error(`Cannot calculate keyspace`);

    console.log(`Keyspace size computed. Keyspace size = ${keyspace}.`);
    const step = Math.floor(keyspace / args.numberOfProviders + 1);
    const range = [...Array(Math.floor(keyspace / step) + 1).keys()].map((i) => i * step);

    const futureResults = range.map(async (skip = 0) => {
      return executor
        .run(async (ctx) => {
          const results = await ctx
            .beginBatch()
            .run(
              `hashcat -a 3 -m 400 '${args.hash}' '${args.mask}' --skip=${skip} --limit=${Math.min(
                keyspace,
                skip + step,
              )} -o pass.potfile`,
            )
            .run("cat pass.potfile")
            .end();
          if (!results?.[1]?.stdout) return false;
          return results?.[1]?.stdout.toString().split(":")[1];
        })
        .catch((err) => console.error(err));
    });

    const results = await Promise.all(futureResults);

    let password = "";
    for (const result of results) {
      if (result) {
        password = result;
        break;
      }
    }

    if (!password) console.log("No password found");
    else console.log(`Password found: ${password}`);
  } catch (e) {
    console.error(e);
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
