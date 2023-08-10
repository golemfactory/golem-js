import { TaskExecutor, AgreementSelectors } from "@golem-sdk/golem-js";

/**
 * Example demonstrating how to use predefined selector `bestAgreementSelector`,
 * which choose the best provider based on scores provided as object: [providerId]: score
 * A higher score rewards the provider.
 */
const scores = {
  "0x79bcfdc92af492c9b15ce9f690c3ccae53437179": 100,
  "0x3c6a3f59518a0da1e75ea4351713bfe908e6642c": 50,
  "0x1c1c0b14e321c258f7057e29533cba0081df8bb8": 25,
};

(async function main() {
  const executor = await TaskExecutor.create({
    package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
    agreementSelector: AgreementSelectors.bestAgreementSelector(scores),
  });
  await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
  await executor.end();
})();
