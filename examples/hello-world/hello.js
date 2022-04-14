const {
  Executor,
  Task,
  utils: { asyncWith },
  vm,
} = require("yajsapi");

async function main() {
  const task_package = await vm.repo({
    image_hash: "d646d7b93083d817846c2ae5c62c72ca0507782385a2e29291a3d376",
  });
  const tasks = [new Task({})];

  async function* worker(context, tasks) {
    for await (let task of tasks) {
      context.run("/bin/sh", ["-c", "date"]);
      const future_result = yield context.commit();
      const { results } = await future_result;
      task.accept_result(results[results.length - 1]);
    }
  }

  await asyncWith(new Executor({ task_package, budget: "1.0", subnet_tag: "devnet-beta" }), async (executor) => {
    for await (let completed of executor.submit(worker, tasks)) {
      console.log(completed.result().stdout);
    }
  });
}

main();
