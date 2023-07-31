import { TaskExecutor } from "yajsapi";
import { program } from "commander";

async function main(args) {


const executor = await TaskExecutor.create({
   package: "",
   maxParallelTasks: args.numberOfProviders,
   yagnaOptions: { apiKey: `try_golem` }
 });


 const keyspace = await executor.run(async (ctx) => {
   const result = await ctx.run(`hashcat --keyspace -a 3 ${args.mask} -m 400`);
   return parseInt(result.stdout || "");
 });

 if (!keyspace) throw new Error(`Cannot calculate keyspace`);

 console.log(`Keyspace size computed. Keyspace size = ${keyspace}.`);
 const step = Math.floor(keyspace / args.numberOfProviders + 1);
 const range = [...Array(Math.floor(keyspace / step)+1).keys()].map((i) => i*step);

 const results = executor.map(range, async (ctx, skip = 0) => {
   console.log(`hashcat -a 3 -m 400 '${args.hash}' '${args.mask}' --skip=${skip} --limit=${Math.min(keyspace-1,skip + step-1)} -o pass.potfile`);
   const results = await ctx
           .beginBatch()
           .run(`hashcat -a 3 -m 400 '${args.hash}' '${args.mask}' --skip=${skip} --limit=${Math.min(keyspace-1,skip + step-1)} -o pass.potfile`)
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
 .option("--number-of-providers <number_of_providers>", "number of providers", (value) => parseInt(value), 3)
 .option("--mask <mask>")
 .requiredOption("--hash <hash>");
program.parse();
const options = program.opts();
main(options).catch((e) => console.error(e));
