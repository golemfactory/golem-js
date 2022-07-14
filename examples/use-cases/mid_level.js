async function main() {
  const allocation = new Allocation();
  await allocation.send();
  const demand = new Demand(allocation, ai_models_vm_repos[model]);
  const market = new Market();
  const demandId = await market.sendDemnad(demand);
  const strategy = new Strategy("todo");
  const proposal = await market.findBestProposal(demandId, strategy);
  const agreement = new Agreement(proposal);
  const agreementId = await agreement.sign();
  const activity = new Activity(agreementId);

  const script = new Script();
  script.addCommand("run", { cmd: "/bin/sh", args: ["-c", 'echo "Hello World"'] });
  const results = await activity.execute(script.getExeScriptRequest());

  for await (const result of results) {
    console.log(`command #${result.index}`, "result:", result.result, "stdout: ", result.stdout);
  }
}
