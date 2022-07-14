async function main() {
  const service = new Service({
    todo,
  });

  const deploy_package = new Package({ image_hash: "todo" });
  const golem = new Golem({
    deploy_package,
    services: [service],
    network: true,
    other_options,
  });
  const results = await golem.run();

  const networkUri = golem.getNetworkUri();

  results.on("data", (result) => {
    console.log(`Task: ${result.task_id}, Provider: ${result.provider_id}, Stdout: ${result.stdout}`);
  });
}
