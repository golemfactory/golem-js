const { createExecutor, utils } = require("../../../dist");
const { logUtils, range } = utils;

async function main() {
  const executor = await createExecutor({
    package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
    minMem_gib: 0.5,
    minStorage_gib: 2.0,
    maxWorkers: 1,
    timeout: 6 * 60 * 1000,
    budget: "10.0",
    subnetTag: "goth",
    payment: { driver: "erc20", network: "rinkeby" },
    eventConsumer: logUtils.logSummary(),
  });

  await executor.forEach(range(0, 3), async (ctx) => {
    const result = await ctx.run("/bin/sleep", ["1"]);
    console.log(`Task computed: ${result.stdout}`);
  });

  await executor.end();
}

utils.changeLogLevel("debug");
main();
