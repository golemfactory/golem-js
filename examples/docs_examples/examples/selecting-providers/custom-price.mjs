import { TaskExecutor} from "yajsapi";

/**
 * Example demonstrating how to write a custom proposal filter.
 */

var costData = [];

const myFilter = async (proposal) => {

   let decision = false; 
   let usageVecor = proposal.properties['golem.com.usage.vector'];
   let counterIdx = usageVecor.findIndex((ele) => ele === 'golem.usage.duration_sec');
   let proposedCost = proposal.properties['golem.com.pricing.model.linear.coeffs'][counterIdx];
   costData.push(proposedCost);
  if (costData.length < 11) return false;
   else {
    costData.shift();
    let averageProposedCost = costData.reduce((part, x) => part + x, 0)/10;
    if ( proposedCost <= averageProposedCost) decision = true;
    if (decision) {console.log(proposedCost, averageProposedCost)}
  }
  console.log(costData);
  console.log(proposal.properties['golem.node.id.name'] , proposal.properties['golem.com.pricing.model.linear.coeffs']);  
  return decision;
};
/*
const myFilter2 = async (proposal) => {

    console.log(proposal.properties['golem.com.usage.vector'], 
                proposal.properties['golem.node.id.name']);
    return false;
}*/

(async function main() {
  const executor = await TaskExecutor.create({
    package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
    proposalFilter: myFilter,
    yagnaOptions: { apiKey: 'f153492c12e0422d89f3b95017bca735' }

  });
  await executor.run(async (ctx) => console.log((await ctx.run(`echo "This task is run on ${ctx.provider.id}"`)).stdout, ctx.provider.id));
  await executor.end();
})();
