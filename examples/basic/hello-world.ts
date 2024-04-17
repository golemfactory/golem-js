import {
  YagnaApi,
  MarketModuleImpl,
  ActivityModuleImpl,
  PaymentModuleImpl,
  DraftOfferProposalPool,
  WorkContext,
} from "@golem-sdk/golem-js";

(async () => {
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
    const invoiceFilter = () => true;
    const debitNoteFilter = () => true;
    const proposalPool = new DraftOfferProposalPool();
    const proposalSubscription = await modules.market.startCollectingProposal(demandOptions, proposalPool);
    const draftProposal = await proposalPool.acquire();
    const agreement = await modules.market.proposeAgreement(modules.payment, draftProposal, { invoiceFilter });
    const activity = await modules.activity.createActivity(modules.payment, agreement, { debitNoteFilter });
    const ctx = new WorkContext(activity, {});
    const result = await ctx.run("echo Hello World");
    console.log(result.stdout);
    proposalSubscription.cancel();
    await proposalPool.clear();
  } catch (err) {
    console.error("Failed to run example on Golem", err);
  }
})().catch(console.error);
