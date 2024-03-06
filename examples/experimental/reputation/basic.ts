import { TaskExecutor, sleep } from "@golem-sdk/golem-js";
import { ReputationSystem } from "@golem-sdk/golem-js/experimental";

/**
 * This example uses the reputation system to filter out proposals from providers with low reputation and ones that were not tested yet.
 *
 * This improves the likelihood of successful computations.
 *
 * This is an experimental feature and the API is subject to change.
 *
 * @experimental
 */
(async function main() {
  console.log("WARNING: This test always run on polygon, so real costs will occur.");
  console.log("If you do not wish to continue, press Ctrl+C to abort.");
  console.log("The test will start in 5 seconds...");
  await sleep(5, false);

  const reputation = await ReputationSystem.create({
    paymentNetwork: "polygon",
  });

  console.log("Listed providers:", reputation.getData().providers.length);

  const executor = await TaskExecutor.create({
    payment: { network: "polygon" },
    package: "golem/alpine:latest",
    proposalFilter: reputation.proposalFilter(),
    agreementSelector: reputation.agreementSelector(),
  });

  try {
    await executor.run(async (ctx) => {
      const result = await ctx.run("echo 'Hello World'");
      console.log(result.stdout);
    });
  } catch (error) {
    console.error("Computation failed:", error);
  } finally {
    await executor.shutdown();
  }
})();
