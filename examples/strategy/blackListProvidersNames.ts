import { TaskExecutor, ProposalFilters } from "@golem-sdk/golem-js";

/**
 * Example demonstrating how to use the predefined filter `blackListProposalNamesFilter`,
 * which blocking any proposal coming from a provider whose name is in the array
 */

const blackListProvidersNames = ["provider-1", "golem-provider", "super-provider"];

(async function main() {
  const executor = await TaskExecutor.create({
    package: "golem/alpine:latest",
    proposalFilter: ProposalFilters.blackListProposalNamesFilter(blackListProvidersNames),
  });
  await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
  await executor.end();
})();
