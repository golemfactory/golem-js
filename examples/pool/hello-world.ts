import {
  ActivityModuleImpl,
  ActivityPool,
  AgreementPool,
  DraftOfferProposalPool,
  MarketApiAdapter,
  MarketModuleImpl,
  PaymentModuleImpl,
  YagnaApi,
} from "@golem-sdk/golem-js";

(async function main() {
  const yagnaApi = new YagnaApi();
  const marketApi = new MarketApiAdapter(yagnaApi);

  try {
    await yagnaApi.connect();

    const modules = {
      market: new MarketModuleImpl(marketApi, yagnaApi),
      activity: new ActivityModuleImpl(yagnaApi),
      payment: new PaymentModuleImpl(yagnaApi, {
        driver: "erc20",
        network: "holesky",
      }),
    };

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
    const allocation = await modules.payment.createAllocation({ budget: 1 });
    const demandSpecification = await modules.market.buildDemand(demandOptions.demand, allocation);

    const proposals$ = modules.market.startCollectingProposals({
      demandSpecification,
    });
    const proposalSubscription = proposalPool.readFrom(proposals$);

    /** How many providers you plan to engage simultaneously */
    const CONCURRENCY = 2;

    const agreementPool = new AgreementPool(modules, proposalPool, { replicas: { max: CONCURRENCY } });
    const activityPool = new ActivityPool(modules, agreementPool, {
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
    await yagnaApi.disconnect();
  }
})();
