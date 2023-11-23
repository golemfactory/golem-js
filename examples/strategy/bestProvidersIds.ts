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
    package: "golem/alpine:latest",
    agreementSelector: AgreementSelectors.bestAgreementSelector(scores),
  });

  try {
    await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
  } catch (err) {
    console.error("Task execution failed:", err);
  } finally {
    await executor.end();
  }
})();
