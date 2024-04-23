import {
  ActivityModuleImpl,
  Allocation,
  DraftOfferProposalPool,
  MarketModuleImpl,
  Package,
  PaymentModuleImpl,
  WorkContext,
  YagnaApi,
  LeaseProcess,
  InvoiceRepository,
  DebitNoteRepository,
  PaymentApiAdapter,
} from "@golem-sdk/golem-js";

import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

(async () => {
  const logger = pinoPrettyLogger({
    level: "info",
  });

  const yagnaApi = new YagnaApi({
    logger,
  });

  const paymentApiAdapter = new PaymentApiAdapter(
    yagnaApi,
    new InvoiceRepository(yagnaApi.payment, yagnaApi.market),
    new DebitNoteRepository(yagnaApi.payment, yagnaApi.market),
    logger,
  );

  try {
    await yagnaApi.connect();
    await paymentApiAdapter.connect();

    const modules = {
      market: new MarketModuleImpl(yagnaApi, logger),
      activity: new ActivityModuleImpl(yagnaApi, logger),
      payment: new PaymentModuleImpl(yagnaApi, logger),
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

    const proposalPool = new DraftOfferProposalPool({
      logger,
    });

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
      })
      .subscribe((proposalsBatch) => proposalsBatch.forEach((proposal) => proposalPool.add(proposal)));

    const draftProposal = await proposalPool.acquire();

    const agreement = await modules.market.proposeAgreement(modules.payment, draftProposal);

    const lease = new LeaseProcess(agreement, allocation, paymentApiAdapter, logger);
    // console.log(lease)

    const activity = await modules.activity.createActivity(agreement);

    // We managed to create the activity, no need to look for more agreement candidates
    proposalSubscription.unsubscribe();

    // Access your work context to perform operations
    const ctx = new WorkContext(activity, {});
    await ctx.before();

    // Perorm your work
    const result = await ctx.run("echo Hello World");
    console.log("Result=", result.stdout);

    // Start clean shutdown procedure for business components
    await modules.activity.destroyActivity(activity);
    await modules.market.terminateAgreement(agreement);
    await proposalPool.remove(draftProposal);

    // This will keep the script waiting for payments etc
    await lease.terminated();
  } catch (err) {
    console.error("Failed to run example on Golem", err);
  } finally {
    // Clean shutdown of infrastructure components
    await paymentApiAdapter.disconnect();
    await yagnaApi.disconnect();
  }
})().catch(console.error);
