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
        image: "file://golem_node_20.gvmi",
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

    const proposalPool = new DraftOfferProposalPool();
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
    const agreementPool = new AgreementPool(modules, proposalPool, {
      poolOptions: { min: 1 },
    });
    const activityPool = new ActivityPool(modules, agreementPool, {
      poolOptions: { min: 2 },
    });
    const ctx = await activityPool.acquire();
    const result = await ctx.run("echo Hello World");
    console.log(result.stdout);
    proposalSubscription.unsubscribe();
    await agreementPool.drain();
    await activityPool.drain();
  } catch (err) {
    console.error("Pool execution failed:", err);
  } finally {
    await yagnaApi.disconnect();
  }
})();
