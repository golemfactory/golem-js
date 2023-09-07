import { ProposalFilter, TaskExecutor } from "@golem-sdk/golem-js";

/**
 * Example demonstrating how to write a custom proposal filter.
 * In this case the proposal must include VPN access and must not be from "bad-provider"
 */
const myFilter: ProposalFilter = async (proposal) => {
  return (
    proposal.provider.name !== "bad-provider" || !proposal.properties["golem.runtime.capabilities"]?.includes("vpn")
  );
};

(async function main() {
  const executor = await TaskExecutor.create({
    package: "golem/alpine:3.18.2",
    proposalFilter: myFilter,
  });
  await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
  await executor.end();
})();
