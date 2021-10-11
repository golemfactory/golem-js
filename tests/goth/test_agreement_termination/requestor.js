const { Executor, Task, utils, vm, WorkContext } = require("../../../dist");
const { asyncWith, logUtils, range } = utils;

async function main() {
  const _package = await vm.repo({
    image_hash: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
    min_mem_gib: 0.5,
    min_storage_gib: 2.0,
  });

  let first_worker = true;

  /*
  A worker function for `Executor.submit()`.
  The first call to this function will produce a worker
  that sends an invalid `run` command to the provider.
  This should cause `yield ctx.commit()` to fail.
  The remaining calls will just send `sleep 5` to the
  provider to simulate some work.
  */
  async function* worker(ctx, tasks) {
    let should_fail = first_worker;
    first_worker = false;

    for await (let task of tasks) {
      if (should_fail) {
        ctx.run("xyz");
        yield ctx.commit();
      } else {
        ctx.run("/bin/sleep", ["1"]);
        yield ctx.commit();
      }
      task.accept_result();
    }
  }

  await asyncWith(
    new Executor({
      task_package: _package,
      max_workers: 1,
      timeout: 6 * 60 * 1000,
      budget: "10.0",
      subnet_tag: "goth",
      driver: "polygon",
      network: "rinkeby",
      event_consumer: logUtils.logSummary(),
    }),
    async (executor) => {
      const tasks = range(0, 6).map((frame) => new Task(frame));
      for await (let task of executor.submit(worker, tasks)) {
        console.log(`Task computed: ${task.result()}`);
      }
      console.log("All tasks computed");
    }
  );
  return;
}

utils.changeLogLevel("debug");
main();
