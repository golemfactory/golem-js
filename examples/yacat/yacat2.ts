import { TaskExecutor } from "@golem-sdk/golem-js";

const range = (start: number, end: number, step = 1): number[] => {
  const list: number[] = [];
  for (let index = start; index < end; index += step) list.push(index);
  return list;
};

(async function main() {
  const mask = "?a?a";
  const hash = "$P$5ZDzPE45CigTC6EY4cXbyJSLj/pGee0";
  const executor = await TaskExecutor.create({
    package: "golem/examples-hashcat:latest",
    budget: 10,
    maxParallelTasks: 2,
  });
  const keyspace = await executor.run<number>(async (ctx) => {
    const result = await ctx.run(`hashcat --keyspace -a 3 ${mask} -m 400`);
    return parseInt(result.stdout?.toString() || "");
  });
  console.log(keyspace);
  if (!keyspace) return;
  const step = Math.floor(keyspace / 3);
  const ranges = range(0, keyspace, step);
  const results = executor.map(ranges, async (ctx, skip) => {
    const results = await ctx
      .beginBatch()
      .run(`hashcat -a 3 -m 400 '${hash}' '${mask}' --skip=${skip} --limit=${skip! + step} -o pass.potfile2`)
      .run("cat pass.potfile")
      .end();
    console.log({ results });
    if (!results?.[1]?.stdout) return false;
    return results?.[1]?.stdout.toString().split(":")?.[1]?.trim();
  });
  let password = "";
  for await (const result of results) {
    if (result) {
      password = result;
      break;
    }
  }
  console.log({ password });
  await executor.end();
})();
