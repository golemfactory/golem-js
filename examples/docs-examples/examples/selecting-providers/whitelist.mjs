import { TaskExecutor, ProposalFilters } from "@golem-sdk/golem-js";

/**
 * Example demonstrating how to use the predefined filter `whiteListProposalIdsFilter`,
 * which only allows offers from a provider whose ID is in the array
 */

const whiteListIds = ["0x3fc1d65ddc5258dc8807df30a29f71028e965e1b", "0x4506550de84d207f3ab90add6336f68119015836"];
console.log("Will accept only proposals from:");
for (let i = 0; i < whiteListIds.length; i++) {
  console.log(whiteListIds[i]);
}

(async function main() {
  const executor = await TaskExecutor.create({
    package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
    proposalFilter: ProposalFilters.whiteListProposalIdsFilter(whiteListIds),
    yagnaOptions: { apiKey: "try_golem" },
  });
  await executor.run(async (ctx) =>
    console.log((await ctx.run(`echo "This task is run on ${ctx.provider.id}"`)).stdout, ctx.provider.id),
  );
  await executor.end();
})();
