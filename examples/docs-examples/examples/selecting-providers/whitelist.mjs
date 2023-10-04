import { TaskExecutor, ProposalFilters } from "@golem-sdk/golem-js";

/**
 * Example demonstrating how to use the predefined filter `whiteListProposalIdsFilter`,
 * which only allows offers from a provider whose ID is in the array
 */

const whiteListIds = [
  "0x3a21c608925ddbc745afab6375d1f5e77283538e",
  "0xd79f83f1108d1fcbe0cf57e13b452305eb38a325",
  "0x677c5476f3b0e1f03d5c3abd2e2e2231e36fddde",
  "0x06c03165aaa676680b9d02c1f3ee846c3806fec7",
  "0x17ec8597ff92c3f44523bdc65bf0f1be632917ff", // goth provider-1:
  "0x63fc2ad3d021a4d7e64323529a55a9442c444da0", // goth provider-2:
];
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
