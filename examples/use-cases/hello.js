const { Task, Package, Golem } = require("./todo");

async function main() {
  const task = new Task();
  task.run("/bin/sh", ["-c", "date"]);

  const task_package = new Package({
    image_hash: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
    min_mem_gib: 0.5,
    min_storage_gib: 2.0,
  });
  const golem = new Golem({
    package: task_package,
    tasks: [task],
  });
  const results = await golem.run();

  results.on("data", async (result) => {
    console.log(`Task: ${result.task_id}, Provider: ${result.provider_id}, Stdout: ${result.stdout}`);
    await golem.acceptTaskResult(result.task_id);
  });
}

main();
