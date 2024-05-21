import { DraftOfferProposalPool, GolemNetwork } from "@golem-sdk/golem-js";

import { pinoPrettyLogger } from "@golem-sdk/pino-logger";
import { fileURLToPath } from "url";

// get the absolute path to the local image in case this file is run from a different directory
const getImagePath = (path: string) => fileURLToPath(new URL(path, import.meta.url).toString());

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
        activity: {
          // Here you supply the path to the GVMI file that you want to deploy and use
          // using the file:// protocol will make the SDK switch to "GVMI" serving mode
          imageUrl: `file://${getImagePath("./alpine.gvmi")}`,
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

    const allocation = await glm.payment.createAllocation({
      budget: 1,
      expirationSec: 30 * 60, // 30 minutes
    });
    const demandSpecification = await glm.market.buildDemandDetails(demand.demand, allocation);
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
    const result = await ctx.run("cat hello.txt");
    console.log("Contents of 'hello.txt': ", result.stdout?.toString().trim());

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
