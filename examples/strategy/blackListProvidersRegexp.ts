import { TaskExecutor, ProposalFilters } from "@golem-sdk/golem-js";

/**
 * Example demonstrating how to use the predefined selector `blackListProposalRegexpFilter`,
 * which blocking any proposal coming from a provider whose name match to the regexp
 */

(async function main() {
  const executor = await TaskExecutor.create({
    package: "golem/alpine:latest",
    proposalFilter: ProposalFilters.blackListProposalRegexpFilter(/bad-provider*./),
  });

  try {
    await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
  } catch (err) {
    console.error("Task execution failed:", err);
  } finally {
    await executor.shutdown();
  }
})();
