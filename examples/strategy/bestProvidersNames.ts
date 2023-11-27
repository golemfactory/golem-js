import { TaskExecutor, AgreementCandidate } from "@golem-sdk/golem-js";

/**
 * Example demonstrating how to write a selector which choose the best provider based on scores provided as object: [providerName]: score
 * A higher score rewards the provider.
 */
const scores = {
  "provider-1": 100,
  "golem-provider": 50,
  "super-provider": 25,
};

const bestProviderSelector =
  (scores: { [providerName: string]: number }) => async (candidates: AgreementCandidate[]) => {
    candidates.sort((a, b) =>
      (scores?.[a.proposal.provider.name] || 0) >= (scores?.[b.proposal.provider.name] || 0) ? 1 : -1,
    );
    return candidates[0];
  };

(async function main() {
  const executor = await TaskExecutor.create({
    package: "golem/alpine:latest",
    agreementSelector: bestProviderSelector(scores),
  });

  try {
    await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
  } catch (err) {
    console.error("Task execution failed:", err);
  } finally {
    await executor.shutdown();
  }
})();
