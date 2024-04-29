import {
  ActivityModuleImpl,
  ActivityPool,
  AgreementPool,
  DraftOfferProposalPool,
  GolemNetwork,
  MarketApiAdapter,
  MarketModuleImpl,
  PaymentModuleImpl,
  YagnaApi,
} from "@golem-sdk/golem-js";

(async function main() {
  const glm = new GolemNetwork({
    payment: {
      payment: {
        driver: "erc20",
        network: "holesky",
      },
    },
  });

  try {
    await glm.connect();

    const demandOptions = {
      demand: {
        imageTag: "golem/alpine:latest",
        minCpuCores: 4,
        minMemGib: 8,
        minStorageGib: 16,
      },
      market: {
        rentHours: 12,
        pricing: {
          maxStartPrice: 1,
          maxCpuPerHourPrice: 1,
          maxEnvPerHourPrice: 1,
        },
        withProviders: ["0x123123"],
        withoutProviders: ["0x123123"],
        withOperators: ["0x123123"],
        withoutOperators: ["0x123123"],
      },
    };

    const proposalPool = new DraftOfferProposalPool({ minCount: 1 });
    const payerDetails = await glm.payment.getPayerDetails();
    const demandSpecification = await glm.market.buildDemand(demandOptions.demand, payerDetails);

    const proposals$ = glm.market.startCollectingProposals({
      demandSpecification,
    });

    const proposalSubscription = proposalPool.readFrom(proposals$);

    // TODO: allocation is not used in this example?
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const allocation = await glm.payment.createAllocation({ budget: 1 });

    /** How many providers you plan to engage simultaneously */
    const CONCURRENCY = 2;

    const depModules = {
      market: glm.market,
      activity: glm.activity,
      payment: glm.payment,
    };

    // TODO: Optimize constructor params
    const agreementPool = new AgreementPool(depModules, proposalPool, { replicas: { max: CONCURRENCY } });
    const activityPool = new ActivityPool(depModules, agreementPool, {
      replicas: CONCURRENCY,
    });

    const ctx = await activityPool.acquire();
    const result = await ctx.run("echo Hello World");
    console.log(result.stdout);

    const ctx2 = await activityPool.acquire();
    const result2 = await ctx.run("echo Hello Golem");
    console.log(result2.stdout);

    await activityPool.release(ctx);
    await activityPool.release(ctx2);

    proposalSubscription.unsubscribe();
    await activityPool.drainAndClear();
    await agreementPool.drainAndClear();
  } catch (err) {
    console.error("Pool execution failed:", err);
  } finally {
    await glm.disconnect();
  }
})();
