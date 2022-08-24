const { Executor, Task, vm } = require("../../dist");
const { readFileSync } = require("fs");

async function main() {
  const manifest = Buffer.from(readFileSync("manifest.json", "utf-8")).toString("base64");
  const manifest_sig = Buffer.from(readFileSync("manifest.json.sign.base64", "utf-8")).toString("base64");
  const manifest_cert = Buffer.from(readFileSync("foo_req.cert.pem", "utf-8")).toString("base64");
  const manifest_sig_algorithm = "sha256";
  const task_package = await vm.manifest({
    manifest,
    manifest_sig,
    manifest_cert,
    manifest_sig_algorithm,
    capabilities: ["inet", "manifest-support"],
  });
  const tasks = [new Task({})];

  async function* worker(context, tasks) {
    for await (let task of tasks) {
      context.run("/bin/sh", [
        "-c",
        "GOLEM_PRICE=`curl -X 'GET' 'https://api.coingecko.com/api/v3/simple/price?ids=golem&vs_currencies=usd' " +
          "-H 'accept: application/json' | jq .golem.usd`; echo ---;echo \"Golem price: $GOLEM_PRICE USD\";echo ---;",
      ]);
      const future_result = yield context.commit();
      const { results } = await future_result;
      task.accept_result(results[results.length - 1]);
    }
  }

  const executor = new Executor({ task_package, budget: "1.0", subnet_tag: "devnet-beta" });
  await executor.run(async (executor) => {
    for await (let completed of executor.submit(worker, tasks)) {
      console.log(completed.result().stdout);
    }
  });
}

main();
