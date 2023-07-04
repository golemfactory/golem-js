import { TaskExecutor, ProposalFilters } from "yajsapi";

/**
 * Example demonstrating how to use the predefined filter `whiteListProposalIdsFilter`,
 * which only allows offers from a provider whose id is in the array
 */

const whiteListIds = [
  "0x79bcfdc92af492c9b15ce9f690c3ccae53437179",
  "0x3c6a3f59518a0da1e75ea4351713bfe908e6642c",
  "0x1c1c0b14e321c258f7057e29533cba0081df8bb8",
];

(async function main() {
  const executor = await TaskExecutor.create({
    package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
    proposalFilter: ProposalFilters.whiteListProposalIdsFilter(whiteListIds),
  });
  await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
  await executor.end();
})();
