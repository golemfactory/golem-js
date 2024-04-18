/**
 * This example demonstrates how to scan the market for proposals
 * Let's lear what is the average start price
 */
import { Package, MarketModuleImpl, YagnaApi, Allocation, ProposalNew } from "@golem-sdk/golem-js";

const yagnaApi = new YagnaApi({
  apiKey: "try_golem",
});
const marketModule = new MarketModuleImpl(yagnaApi);

async function main() {
  const address = (await yagnaApi.identity.getIdentity()).identity;
  const paymentPlatform = "erc20-holesky-tglm";

  const allocation = await Allocation.create(yagnaApi, {
    account: {
      address,
      platform: paymentPlatform,
    },
    budget: 1,
  });
  const workload = Package.create({
    imageTag: "golem/alpine:latest",
  });

  const demandOffer = await marketModule.buildDemand(workload, allocation, {});

  const offers = new Set<ProposalNew>();

  console.log("Scanning the market...");
  const subscription = marketModule
    .startCollectingProposals({
      demandOffer,
      paymentPlatform,
      bufferSize: 10,
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
