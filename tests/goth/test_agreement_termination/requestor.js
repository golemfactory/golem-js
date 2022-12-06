const { utils, createExecutor } = require("../../../dist");
const { logUtils, range } = utils;

async function main() {
  const executor = await createExecutor({
    package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
    minMemGib: 0.5,
    minStorageGib: 2.0,
    maxWorkers: 1,
    timeout: 6 * 60 * 1000,
    budget: "10.0",
    subnetTag: "goth",
    payment: { driver: "erc20", network: "rinkeby" },
    eventConsumer: logUtils.logSummary(),
  });

  await executor.run(async (ctx) => {
    ctx.acceptResult();
    await ctx.run("invalid_command");
  });

  const results = await executor.map(range(0, 5), async (ctx) => ctx.run("/bin/sleep", ["1"]));

  for await (let result of results) {
    console.log(`Task computed: ${result.index}`);
  }
  console.log("All tasks computed");
  await executor.end();
}

utils.changeLogLevel("debug");
main();
