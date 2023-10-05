import { TaskExecutor, ProposalFilters } from "@golem-sdk/golem-js";

/**
 * Example demonstrating how to use the predefined filter `whiteListProposalNamesFilter`,
 * which only allows offers from a provider whose name is in the array
 */

const whiteListNames = ["provider-2"];
console.log("Will accept only proposals from:");
for (let i = 0; i < whiteListNames.length; i++) {
  console.log(whiteListNames[i]);
}

(async function main() {
  const executor = await TaskExecutor.create({
    package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
    proposalFilter: ProposalFilters.whiteListProposalNamesFilter(whiteListNames),
    yagnaOptions: { apiKey: "try_golem" },
  });
  await executor.run(async (ctx) =>
    console.log((await ctx.run(`echo "This task is run on ${ctx.provider.name}"`)).stdout, ctx.provider.name),
  );
  await executor.end();
})();
