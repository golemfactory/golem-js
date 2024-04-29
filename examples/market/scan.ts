/**
 * This example demonstrates how to scan the market for proposals
 * Let's lear what is the average start price
 */
import { GolemNetwork, ProposalNew } from "@golem-sdk/golem-js";

const glm = new GolemNetwork({
  payment: {
    payment: {
      network: "holesky",
      driver: "erc20",
    },
  },
});

async function main() {
  try {
    await glm.connect();

    const allocation = await glm.payment.createAllocation({ budget: 1 });
    const demandSpecification = await glm.market.buildDemand(
      {
        imageTag: "golem/alpine:latest",
      },
      allocation,
    );

    const offers = new Set<ProposalNew>();

    console.log("Scanning the market...");
    const subscription = glm.market
      .startCollectingProposals({
        demandSpecification,
        bufferSize: 5,
      })
      .subscribe({
        next: (proposals) => {
          console.log("Received a batch of ", proposals.length, " offers...");
          proposals.forEach((proposal) => offers.add(proposal));
        },
        error: (e) => {
          console.error("Error while collecting proposals", e);
        },
      });

    setTimeout(() => {
      subscription.unsubscribe();

      const offersArray = [...offers.values()];
      const offersCount = offersArray.length;
      const averagePrice = offersArray.reduce((total, offer) => (total += offer.pricing.start), 0) / offersCount;

      console.log(`Collected ${offersCount} offers from the market with the start price of ${averagePrice}`);
    }, 10_000);
  } catch (err) {
    console.error("Error while executing the example", err);
  } finally {
    await glm.disconnect();
  }
}

main().catch((err) => console.error(err, "Error in main"));
