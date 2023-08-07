import { TaskExecutor, AgreementCandidate } from "yajsapi";

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
    package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
    agreementSelector: bestProviderSelector(scores),
  });
  await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
  await executor.end();
})();
