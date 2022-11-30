const { createExecutor, utils } = require("../../../dist");

async function main() {
  const executor = await createExecutor({
    package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
    min_mem_gib: 0.5,
    min_storage_gib: 2.0,
    max_workers: 1,
    timeout: 6 * 60 * 1000,
    budget: "10.0",
    subnet_tag: "goth",
    driver: "erc20",
    network: "rinkeby",
    logLevel: "debug",
  });

  await executor.forEach(utils.range(0, 3), async (ctx) => {
    const result = await ctx.run("/bin/sleep", ["1"]);
    console.log(`Task computed: ${result.stdout}`);
  });

  await executor.end();
}
main();
