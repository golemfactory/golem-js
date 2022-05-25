const { Executor, Task, vm } = require("yajsapi");

async function main() {
  const task_package = await vm.repo({
    image_hash: "d646d7b93083d817846c2ae5c62c72ca0507782385a2e29291a3d376",
  });
  const tasks = [new Task({})];
}

main();
