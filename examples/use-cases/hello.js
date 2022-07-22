const { Task, Package, Golem } = require("./todo");

async function main() {
  const golem = new Golem({
    package: new Package({ image_hash: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae" }),
    budget: "1.0",
    subnet_tag: "devnet-beta",
  });
  await golem.init();
  const task = new Task([["run", "/bin/sh", "-c", "date"]]);
  const result = await golem.runSync([task]);
  console.log(`Task: ${result.task_id}, Provider: ${result.provider_id}, Stdout: ${result.stdout}`);
  await result.accept();
  await golem.end();
}

main();
