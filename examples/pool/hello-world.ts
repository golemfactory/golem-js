import {
  YagnaApi,
  MarketModuleImpl,
  ActivityModuleImpl,
  PaymentModuleImpl,
  DraftOfferProposalPool,
  AgreementPool,
  ActivityPool,
} from "@golem-sdk/golem-js";

(async function main() {
  try {
    const yagnaApi = new YagnaApi();
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
    const proposalSubscription = await modules.market.startCollectingProposal(demandOptions, proposalPool);
    const agreementPool = new AgreementPool(modules, proposalPool, {
      poolOptions: { min: 1 },
    });
    const activityPool = new ActivityPool(modules, agreementPool, {
      poolOptions: { min: 2 },
    });
    const ctx = await activityPool.acquire();
    const result = await ctx.run("echo Hello World");
    console.log(result.stdout);
    proposalSubscription.cancel();
    await proposalPool.drain();
    await agreementPool.drain();
    await activityPool.drain();
  } catch (err) {
    console.error("Pool execution failed:", err);
  }
})();
