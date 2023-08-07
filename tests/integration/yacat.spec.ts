import { TaskExecutor } from "../../yajsapi";
import { LoggerMock } from "../mock";
const logger = new LoggerMock(false);

const range = (start: number, end: number, step = 1): number[] => {
  const list: number[] = [];
  for (let index = start; index < end; index += step) list.push(index);
  return list;
};

describe("Password cracking", function () {
  let executor: TaskExecutor;
  afterEach(async function () {
    await executor.end();
  });
  it("should crack password", async () => {
    const mask = "?a?a";
    const hash = "$P$5ZDzPE45CigTC6EY4cXbyJSLj/pGee0";
    executor = await TaskExecutor.create({
      package: "055911c811e56da4d75ffc928361a78ed13077933ffa8320fb1ec2db",
      budget: 10,
      logger,
    });
    const keyspace = await executor.run<number>(async (ctx) => {
      const result = await ctx.run(`hashcat --keyspace -a 3 ${mask} -m 400`);
      return parseInt(result.stdout || "");
    });
    expect(keyspace).toEqual(95);
    if (!keyspace) return;
    const step = Math.floor(keyspace / 3);
    const ranges = range(0, keyspace, step);
    const results = executor.map(ranges, async (ctx, skip) => {
      const results = await ctx
        .beginBatch()
        .run(`hashcat -a 3 -m 400 '${hash}' '${mask}' --skip=${skip} --limit=${skip! + step} -o pass.potfile -D 1,2`)
        .run("cat pass.potfile")
        .end();
      if (!results?.[1]?.stdout) return false;
      return results?.[1]?.stdout.split(":")?.[1]?.trim();
    });
    let password = "";
    for await (const result of results) {
      if (result) {
        password = result;
        break;
      }
    }
    expect(password).toEqual("yo");
  });
});
