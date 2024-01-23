import { TaskExecutor, ProposalFilterFactory } from "@golem-sdk/golem-js";

/**
 * Example demonstrating how to use the predefined filter `disallowProvidersById`,
 * which blocking any proposal coming from a provider whose id is in the array
 */

const blackListProvidersIds = [
  "0x79bcfdc92af492c9b15ce9f690c3ccae53437179",
  "0x3c6a3f59518a0da1e75ea4351713bfe908e6642c",
  "0x1c1c0b14e321c258f7057e29533cba0081df8bb8",
];

(async function main() {
  const executor = await TaskExecutor.create({
    package: "golem/alpine:latest",
    proposalFilter: ProposalFilterFactory.disallowProvidersById(blackListProvidersIds),
  });

  try {
    await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
  } catch (error) {
    console.error("Computation failed:", error);
  } finally {
    await executor.shutdown();
  }
})();
