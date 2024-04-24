import { Allocation, DraftOfferProposalPool, GolemNetwork, Package, WorkContext } from "@golem-sdk/golem-js";

import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

(async () => {
  const logger = pinoPrettyLogger({
    level: "debug",
  });

  const glm = new GolemNetwork({
    logger,
  });

  try {
    await glm.connect();

    const demand = {
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
      imageTag: demand.demand.image,
    });

    const allocation = await Allocation.create(glm.services.yagna, {
      account: {
        address: (await glm.services.yagna.identity.getIdentity()).identity,
        platform: "erc20-holesky-tglm",
      },
      budget: 1,
    });

    const demandOffer = await glm.market.buildDemand(workload, allocation, {});

    const proposalSubscription = glm.market
      .startCollectingProposals({
        demandOffer,
        paymentPlatform: "erc20-holesky-tglm",
      })
      .subscribe((proposalsBatch) => proposalsBatch.forEach((proposal) => proposalPool.add(proposal)));

    const draftProposal = await proposalPool.acquire();

    const agreement = await glm.market.proposeAgreement(glm.payment, draftProposal);
    const lease = await glm.market.createLease(agreement, allocation);

    // console.log(lease)

    const activity = await glm.activity.createActivity(agreement);

    // We managed to create the activity, no need to look for more agreement candidates
    proposalSubscription.unsubscribe();

    // Access your work context to perform operations
    const ctx = new WorkContext(activity, {});
    await ctx.before();

    // Perorm your work
    const result = await ctx.run("echo Hello World");
    console.log("Result=", result.stdout);

    // Start clean shutdown procedure for business components
    await glm.activity.destroyActivity(activity);
    await glm.market.terminateAgreement(agreement);
    await proposalPool.remove(draftProposal);

    // This will keep the script waiting for payments etc
    await lease.finalized();
  } catch (err) {
    console.error("Failed to run example on Golem", err);
  } finally {
    // Clean shutdown of infrastructure components
    await glm.disconnect();
  }
})().catch(console.error);
