const { Executor, Task, utils, vm } = require("../../../dist");
const { asyncWith, logUtils, range } = utils;

async function main() {
  const _package = await vm.repo({
    image_hash: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
    min_mem_gib: 0.5,
    min_storage_gib: 2.0,
  });

  async function* worker(work_ctx, tasks) {
    for await (let task of tasks) {
      work_ctx.run("/bin/sleep", ["1"]);
      yield work_ctx.commit({ timeout: 15 * 60 * 1000 });
      task.accept_result();
      return;
    }
  }

  await asyncWith(
    new Executor({
      task_package: _package,
      max_workers: 1,
      timeout: 6 * 60 * 1000,
      budget: "10.0",
      subnet_tag: "goth",
      driver: "erc20",
      network: "rinkeby",
      event_consumer: logUtils.logSummary(),
    }),
    async (executor) => {
      const tasks = range(0, 3).map((frame) => new Task(frame));
      for await (let task of executor.submit(worker, tasks)) {
        console.log(`Task computed: ${task.result()}`);
      }
    }
  );
  return;
}

utils.changeLogLevel("debug");
main();
