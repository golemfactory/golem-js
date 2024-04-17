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
    await modules.market.startCollectingProposal(demandOptions, proposalPool);
    const agreementPool = new AgreementPool(modules, proposalPool);
    const activityPool = new ActivityPool(modules, agreementPool, {
      poolOptions: { min: 2, max: 100 },
    });
    setInterval(
      () =>
        console.log(
          "Proposals available:",
          proposalPool.availableCount(),
          "Proposals borrowed:",
          proposalPool.leasedCount(),
          "Agreement borrowed:",
          agreementPool.getBorrowed(),
          "Agreement pending:",
          agreementPool.getPending(),
          "Activities borrowed:",
          activityPool.getBorrowed(),
          "Activities pending:",
          activityPool.getPending(),
          "Activities available:",
          activityPool.getAvailable(),
        ),
      2000,
    );

    const ctx = await activityPool.acquire();
    const result = await ctx.run("echo Hello World");
    console.log(result.stdout);
    // proposalSubscription.cancel();

    // await new Promise((res) => setTimeout(res, 5_000));
    const ctx2 = await activityPool.acquire();
    const result2 = await ctx.run("echo Hello World222222");
    console.log(result2.stdout);
    await activityPool.release(ctx2);
    await new Promise((res) => setTimeout(res, 5_000));
    await activityPool.destroy(ctx);
    await agreementPool.drain();
  } catch (err) {
    console.error("Pool execution failed:", err);
  }
})();
