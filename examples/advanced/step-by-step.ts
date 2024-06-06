/**
 * This advanced example demonstrates how to perform all market interactions "manually".
 * It should give you a basic understanding of how this SDK works under the hood.
 * If you're just getting started with golem-js, take a look at the basic examples first.
 * Keep in mind that this is not the recommended way to interact with the Golem Network, as
 * it doesn't cover all edge cases and error handling. This example should be used for educational purposes only.
 */
import {
  Allocation,
  GolemNetwork,
  MarketOrderSpec,
  OfferProposal,
  OfferProposalReceivedEvent,
} from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";
import { filter, map, switchMap, take } from "rxjs";

(async () => {
  const logger = pinoPrettyLogger({
    level: "info",
  });

  const glm = new GolemNetwork({
    logger,
  });

  let allocation: Allocation | undefined;
  try {
    await glm.connect();

    // Define the order that we're going to place on the market
    const order: MarketOrderSpec = {
      demand: {
        workload: {
          imageTag: "golem/alpine:latest",
          minCpuCores: 2,
          minMemGib: 4,
        },
        expirationSec: 30 * 60,
      },
      market: {
        // We're only going to rent the provider for 5 minutes max
        rentHours: 5 / 60,
        pricing: {
          model: "linear",
          maxStartPrice: 1,
          maxCpuPerHourPrice: 1,
          maxEnvPerHourPrice: 1,
        },
      },
    };
    // Allocate funds to cover the order, we will only pay for the actual usage
    // so any unused funds will be returned to us at the end
    allocation = await glm.payment.createAllocation({
      budget: glm.market.estimateBudget({ order, concurrency: 1 }),
      expirationSec: order.market.rentHours * 60 * 60,
    });

    // Convert the human-readable order to a protocol-level format that we will publish on the network
    const demandSpecification = await glm.market.buildDemandDetails(order.demand, allocation);

    // Publish the order on the market
    // This methods creates and observable that publishes the order and refreshes it every 30 minutes.
    // Unsubscribing from the observable will remove the order from the market
    const demand$ = glm.market.publishAndRefreshDemand(demandSpecification);

    // Now, for each created demand, let's listen to proposals from providers
    const offerProposal$ = demand$.pipe(
      switchMap((demand) => glm.market.collectMarketProposalEvents(demand)),
      // to keep things simple we don't care about any other events
      // related to this demand, only proposals from providers
      filter((event): event is OfferProposalReceivedEvent => event.type === "ProposalReceived"),
      map((event) => event.proposal),
    );

    // Each received proposal can be in one of two states: initial or draft
    // Initial proposals are the first ones received from providers and require us to respond with a counter-offer
    // Draft proposals are the ones that we have already negotiated and are ready to be accepted
    // Both types come in the same stream, so let's write a handler that will respond to initial proposals
    // and save draft proposals for later
    const draftProposals: OfferProposal[] = [];
    const offerProposalsSubscription = offerProposal$.subscribe((offerProposal) => {
      if (offerProposal.isInitial()) {
        // here we can define our own counter-offer
        // to keep this example simple, we will respond with the same
        // specification as the one we used to publish the demand
        // feel free to modify this to your needs
        glm.market.negotiateProposal(offerProposal, demandSpecification).catch(console.error);
      } else if (offerProposal.isDraft()) {
        draftProposals.push(offerProposal);
      }
    });

    // Let's wait for a couple seconds to receive some proposals
    while (draftProposals.length < 1) {
      console.log("Waiting for proposals...");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    // We have received at least one draft proposal, we can now stop listening for more
    offerProposalsSubscription.unsubscribe();

    // Remember that signing the proposal can fail, so in a production environment
    // you should handle the error and retry with a different proposal.
    // To keep this example simple, we will not retry and just crash if the signing fails
    const draftProposal = draftProposals[0]!;
    const agreement = await glm.market.proposeAgreement(draftProposal);
    console.log("Agreement signed with provider", agreement.getProviderInfo().name);

    // Provider is ready to start the computation
    // Let's setup payment first
    // As the computation happens, we will receive debit notes to inform us about the cost
    // and an invoice at the end to settle the payment
    const invoiceSubscription = glm.payment
      .observeInvoices()
      .pipe(
        // make sure we only process invoices related to our agreement
        filter((invoice) => invoice.agreementId === agreement.id),
        // end the stream after we receive an invoice
        take(1),
      )
      .subscribe((invoice) => {
        console.log("Received invoice for ", invoice.getPreciseAmount().toFixed(4), "GLM");
        glm.payment.acceptInvoice(invoice, allocation!, invoice.amount).catch(console.error);
      });
    const debitNoteSubscription = glm.payment
      .observeDebitNotes()
      .pipe(
        // make sure we only process invoices related to our agreement
        filter((debitNote) => debitNote.agreementId === agreement.id),
      )
      .subscribe((debitNote) => {
        console.log("Received debit note for ", debitNote.getPreciseAmount().toFixed(4), "GLM");
        glm.payment.acceptDebitNote(debitNote, allocation!, debitNote.totalAmountDue).catch(console.error);
      });

    // Start the computation
    // First lets start the activity - this will deploy our image on the provider's machine
    const activity = await glm.activity.createActivity(agreement);
    // Then let's create a WorkContext, which is a set of utilities to interact with the
    // providers machine, like running commands, uploading files, etc.
    const ctx = await glm.activity.createWorkContext(activity);
    // Now we can run a simple command on the provider's machine
    const result = await ctx.run("echo Hello, Golem 👋!");
    console.log("Result of the command ran on the provider's machine:", result.stdout);

    // We're done, let's clean up
    // First we need to destroy the activity
    await glm.activity.destroyActivity(activity);
    // Then let's terminate the agreement
    await glm.market.terminateAgreement(agreement);
    // Before we finish, let's wait for the invoice to be settled
    while (!invoiceSubscription.closed) {
      console.log("Waiting for the invoice to be settled...");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    // We're done! Let's cleanup the subscriptions, release the remaining funds and disconnect from the network
    invoiceSubscription.unsubscribe();
    debitNoteSubscription.unsubscribe();
  } catch (err) {
    console.error("Failed to run example on Golem", err);
  } finally {
    if (allocation) {
      await glm.payment.releaseAllocation(allocation);
    }
    await glm.disconnect();
  }
})().catch(console.error);
