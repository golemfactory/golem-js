import { ProposalFilter, TaskExecutor } from "@golem-sdk/golem-js";

/**
 * Example demonstrating how to write a custom proposal filter.
 * In this case the proposal must include VPN access and must not be from "bad-provider"
 */
const myFilter: ProposalFilter = (proposal) => {
  return (
    proposal.provider.name !== "bad-provider" || !proposal.properties["golem.runtime.capabilities"]?.includes("vpn")
  );
};

(async function main() {
  const executor = await TaskExecutor.create({
    package: "golem/alpine:latest",
    proposalFilter: myFilter,
  });
  try {
    await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
  } catch (err) {
    console.error("Task execution failed:", err);
  } finally {
    await executor.shutdown();
  }
})();
