import {
  YagnaApi,
  MarketModuleImpl,
  ActivityModuleImpl,
  PaymentModuleImpl,
  DraftOfferProposalPool,
  WorkContext,
  Package,
  Allocation,
} from "@golem-sdk/golem-js";

(async () => {
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
    const draftProposal = await proposalPool.acquire();
    const agreement = await modules.market.proposeAgreement(modules.payment, draftProposal);
    const activity = await modules.activity.createActivity(modules.payment, agreement);
    const ctx = new WorkContext(activity, {});
    await ctx.before();
    const result = await ctx.run("echo Hello World");
    console.log(result.stdout);
    proposalSubscription.unsubscribe();
  } catch (err) {
    console.error("Failed to run example on Golem", err);
  } finally {
    await yagnaApi.disconnect();
  }
})().catch(console.error);
