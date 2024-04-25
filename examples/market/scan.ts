/**
 * This example demonstrates how to scan the market for proposals
 * Let's lear what is the average start price
 */
import { MarketModuleImpl, YagnaApi, ProposalNew, MarketApiAdapter, PaymentModuleImpl } from "@golem-sdk/golem-js";

const yagnaApi = new YagnaApi({
  apiKey: "try_golem",
});
const marketApi = new MarketApiAdapter(yagnaApi);
const marketModule = new MarketModuleImpl(marketApi, yagnaApi);
const paymentModule = new PaymentModuleImpl(yagnaApi, {
  network: "holesky",
  driver: "erc20",
});

async function main() {
  const allocation = await paymentModule.createAllocation({ budget: 1 });
  const demandSpecification = await marketModule.buildDemand(
    {
      imageTag: "golem/alpine:latest",
    },
    allocation,
  );

  const offers = new Set<ProposalNew>();

  console.log("Scanning the market...");
  const subscription = marketModule
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
}
main();
