import { TaskExecutor } from "@golem-sdk/golem-js";

/**
 * Example demonstrating how to write a custom proposal filter.
 */

var costData = [];

const myFilter = async (proposal) => {
  let decision = false;
  let usageVector = proposal.properties["golem.com.usage.vector"];
  let counterIdx = usageVector.findIndex((ele) => ele === "golem.usage.duration_sec");
  let proposedCost = proposal.properties["golem.com.pricing.model.linear.coeffs"][counterIdx];
  costData.push(proposedCost);
  if (costData.length < 6) return false;
  else {
    costData.shift();
    let averageProposedCost = costData.reduce((part, x) => part + x, 0) / 5;
    if (proposedCost <= 1.2 * averageProposedCost) decision = true;
    if (decision) {
      console.log(proposedCost, averageProposedCost);
    }
  }
  console.log(costData);
  console.log(proposal.properties["golem.node.id.name"], proposal.properties["golem.com.pricing.model.linear.coeffs"]);
  return decision;
};

(async function main() {
  const executor = await TaskExecutor.create({
    package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
    proposalFilter: myFilter,
    yagnaOptions: { apiKey: "try_golem" },
    startupTimeout: 60_000,
  });
  await executor.run(async (ctx) =>
    console.log((await ctx.run(`echo "This task is run on ${ctx.provider.id}"`)).stdout, ctx.provider.id),
  );
  await executor.end();
})();
