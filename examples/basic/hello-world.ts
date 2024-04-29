import { DraftOfferProposalPool, GolemNetwork } from "@golem-sdk/golem-js";

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
        imageTag: "golem/alpine:latest",
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
      },
    };

    const proposalPool = new DraftOfferProposalPool({
      logger,
    });

    const allocation = await glm.payment.createAllocation({ budget: 1 });
    const demandSpecification = await glm.market.buildDemand(demand.demand, allocation);
    const proposal$ = glm.market.startCollectingProposals({
      demandSpecification,
      bufferSize: 15,
    });
    const proposalSubscription = proposalPool.readFrom(proposal$);
    const draftProposal = await proposalPool.acquire();

    const agreement = await glm.market.proposeAgreement(glm.payment, draftProposal);
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
  } catch (err) {
    console.error("Failed to run example on Golem", err);
  } finally {
    // Clean shutdown of infrastructure components
    await glm.disconnect();
  }
})().catch(console.error);
