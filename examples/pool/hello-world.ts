import {
  YagnaApi,
  MarketModuleImpl,
  ActivityModuleImpl,
  PaymentModuleImpl,
  DraftOfferProposalPool,
  AgreementPool,
  ActivityPool,
  Package,
  Allocation,
} from "@golem-sdk/golem-js";

(async function main() {
  const yagnaApi = new YagnaApi();

  try {
    await yagnaApi.connect();
    const modules = {
      market: new MarketModuleImpl(yagnaApi),
      activity: new ActivityModuleImpl(yagnaApi),
      payment: new PaymentModuleImpl(yagnaApi),
    };
    const demandOptions = {
      demand: {
        image: "golem/alpine:latest",
        resources: {
          minCpu: 4,
          minMemGib: 8,
          minStorageGib: 16,
        },
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
    const workload = Package.create({
      imageTag: demandOptions.demand.image,
    });
    const allocation = await Allocation.create(yagnaApi, {
      account: {
        address: (await yagnaApi.identity.getIdentity()).identity,
        platform: "erc20-holesky-tglm",
      },
      budget: 1,
    });
    const demandOffer = await modules.market.buildDemand(workload, allocation, {});
    const proposalSubscription = modules.market
      .startCollectingProposals({
        demandOffer,
        paymentPlatform: "erc20-holesky-tglm",
        bufferSize: 15,
      })
      .subscribe((proposalsBatch) => proposalsBatch.forEach((proposal) => proposalPool.add(proposal)));
    const agreementPool = new AgreementPool(modules, proposalPool, { replicas: { min: 1 } });
    const activityPool = new ActivityPool(modules, agreementPool, {
      replicas: 2,
    });

    const ctx = await activityPool.acquire();
    const result = await ctx.run("echo Hello World");
    console.log(result.stdout);
    proposalSubscription.unsubscribe();

    const ctx2 = await activityPool.acquire();
    const result2 = await ctx.run("echo Hello Golem");
    console.log(result2.stdout);
    await activityPool.release(ctx2);
    await new Promise((res) => setTimeout(res, 5_000));
    await activityPool.destroy(ctx);
    await agreementPool.drain();
  } catch (err) {
    console.error("Pool execution failed:", err);
  } finally {
    await yagnaApi.disconnect();
  }
})();
