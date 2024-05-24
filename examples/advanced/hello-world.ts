import { DraftOfferProposalPool, GolemNetwork, MarketOrderSpec } from "@golem-sdk/golem-js";

import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

(async () => {
  const logger = pinoPrettyLogger({
    level: "info",
  });

  const glm = new GolemNetwork({
    logger,
  });

  try {
    await glm.connect();

    const order: MarketOrderSpec = {
      demand: {
        workload: {
          imageTag: "golem/alpine:latest",
        },
      },
      market: {
        maxAgreements: 1,
        rentHours: 0.5,
        pricing: {
          model: "linear",
          maxStartPrice: 1,
          maxCpuPerHourPrice: 1,
          maxEnvPerHourPrice: 1,
        },
      },
    };

    const proposalPool = new DraftOfferProposalPool({
      logger,
    });

    const allocation = await glm.payment.createAllocation({
      budget: glm.market.estimateBudget(order),
      expirationSec: 60 * 60, // 60 minutes
    });
    const demandSpecification = await glm.market.buildDemandDetails(order.demand, allocation);
    const proposal$ = glm.market.startCollectingProposals({
      demandSpecification,
      bufferSize: 15,
    });
    const proposalSubscription = proposalPool.readFrom(proposal$);
    const draftProposal = await proposalPool.acquire();

    const agreement = await glm.market.proposeAgreement(draftProposal);

    const lease = await glm.market.createLease(agreement, allocation);
    const activity = await glm.activity.createActivity(agreement);

    // We managed to create the activity, no need to look for more agreement candidates
    proposalSubscription.unsubscribe();

    // Access your work context to perform operations
    const ctx = await glm.activity.createWorkContext(activity);

    // Perform your work
    const result = await ctx.run("echo Hello World");
    console.log("Result=", result.stdout);

    // Start clean shutdown procedure for business components
    await glm.activity.destroyActivity(activity);
    await glm.market.terminateAgreement(agreement);
    await proposalPool.remove(draftProposal);

    // This will keep the script waiting for payments etc
    await lease.finalize();
    await glm.payment.releaseAllocation(allocation);
  } catch (err) {
    console.error("Failed to run example on Golem", err);
  } finally {
    // Clean shutdown of infrastructure components
    await glm.disconnect();
  }
})().catch(console.error);
