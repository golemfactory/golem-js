import { TaskExecutor, ProposalFilters } from "yajsapi";

/**
 * Example demonstrating how to use the predefined filter `blackListProposalNamesFilter`,
 * which blocking any proposal coming from a provider whose name is in the array
 */

const blackListProvidersNames = ["provider-1", "golem-provider", "super-provider"];

(async function main() {
  const executor = await TaskExecutor.create({
    package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
    proposalFilter: ProposalFilters.blackListProposalNamesFilter(blackListProvidersNames),
  });
  await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
  await executor.end();
})();
