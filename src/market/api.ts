import { Observable } from "rxjs";
import { Demand, DemandBodyPrototype, DemandSpecification } from "./demand";
import {
  MarketProposalEvent,
  OfferCounterProposal,
  OfferCounterProposalRejectedEvent,
  OfferPropertyQueryReceivedEvent,
  OfferProposal,
  OfferProposalReceivedEvent,
} from "./proposal";
import {
  Agreement,
  AgreementApproved,
  AgreementCancelledEvent,
  AgreementEvent,
  AgreementRejectedEvent,
  AgreementState,
  AgreementTerminatedEvent,
} from "./agreement";
import { AgreementOptions } from "./agreement/agreement";
import { ScanSpecification, ScannedOffer } from "./scan";

export type MarketEvents = {
  demandSubscriptionStarted: (demand: Demand) => void;
  demandSubscriptionRefreshed: (demand: Demand) => void;
  demandSubscriptionStopped: (demand: Demand) => void;

  /** Emitted when offer proposal from the Provider is received */
  offerProposalReceived: (event: OfferProposalReceivedEvent) => void;

  /** Emitted when the Provider rejects the counter-proposal that the Requestor sent */
  offerCounterProposalRejected: (event: OfferCounterProposalRejectedEvent) => void;

  /** Not implemented */
  offerPropertyQueryReceived: (event: OfferPropertyQueryReceivedEvent) => void;

  offerProposalRejectedByFilter: (offerProposal: OfferProposal, reason?: string) => void;

  /** Emitted when proposal price does not meet user criteria */
  offerProposalRejectedByPriceFilter: (offerProposal: OfferProposal, reason?: string) => void;

  agreementApproved: (event: AgreementApproved) => void;
  agreementRejected: (event: AgreementRejectedEvent) => void;
  agreementTerminated: (event: AgreementTerminatedEvent) => void;
  agreementCancelled: (event: AgreementCancelledEvent) => void;
};

export interface IMarketApi {
  /**
   * Creates a new demand based on the given specification and publishes
   * it to the market.
   * Keep in mind that the demand lasts for a limited time and needs to be
   * refreshed periodically (see `refreshDemand` method).
   * Use `unpublishDemand` to remove the demand from the market.
   */
  publishDemandSpecification(specification: DemandSpecification): Promise<Demand>;

  /**
   * Remove the given demand from the market.
   */
  unpublishDemand(demand: Demand): Promise<void>;

  /**
   * "Publishes" the demand on the network and stats to listen (event polling) for the events representing the feedback
   *
   * The feedback can fall into four categories:
   *
   * - (Initial) We will receive initial offer proposals that were matched by the yagna node which we're using
   * - (Negotiations) We will receive responses from providers with draft offer proposals if we decided to counter the initial proposal
   * - (Negotiations) We will receive an event representing rejection of our counter-proposal by the provider
   * - (Negotiations) We will receive a question from the provider about a certain property as part of the negotiation process (_protocol piece not by yagna 0.15_)
   *
   * @param demand
   *
   * @returns A complex object that allows subscribing to these categories of feedback mentioned above
   */
  collectMarketProposalEvents(demand: Demand): Observable<MarketProposalEvent>;

  /**
   * Start looking at the Agreement related events
   */
  collectAgreementEvents(): Observable<AgreementEvent>;

  /**
   * Sends a counter-proposal to the given proposal. Returns the newly created counter-proposal.
   */
  counterProposal(receivedProposal: OfferProposal, specification: DemandSpecification): Promise<OfferCounterProposal>;

  /**
   * Sends a "reject" response for the proposal that was received from the Provider as part of the negotiation process
   *
   * On the protocol level this means that no further counter-proposals will be generated by the Requestor
   *
   * @param receivedProposal The proposal from the provider
   * @param reason User readable reason that should be presented to the Provider
   */
  rejectProposal(receivedProposal: OfferProposal, reason: string): Promise<void>;

  /**
   * Fetches payment related decorations, based on the given allocation ID.
   *
   * @param allocationId The ID of the allocation that will be used to pay for computations related to the demand
   *
   */
  getPaymentRelatedDemandDecorations(allocationId: string): Promise<DemandBodyPrototype>;

  /**
   * Retrieves an agreement based on the provided ID.
   */
  getAgreement(id: string): Promise<Agreement>;

  /**
   * Request creating an agreement from the provided proposal
   *
   * Use this method if you want to decide what should happen with the agreement after it is created
   *
   * @return An agreement that's in a "Proposal" state (not yet usable for activity creation)
   */
  createAgreement(proposal: OfferProposal, options?: AgreementOptions): Promise<Agreement>;

  /**
   * Request creating an agreement from the provided proposal, send it to the Provider and wait for approval
   *
   * Use this method when you want to quickly finalize the deal with the Provider, but be ready for a rejection
   *
   * @return An agreement that's already in an "Approved" state and can be used to create activities on the Provider
   */
  proposeAgreement(proposal: OfferProposal, options?: AgreementOptions): Promise<Agreement>;

  /**
   * Confirms the agreement with the provider
   */
  confirmAgreement(agreement: Agreement, options?: AgreementOptions): Promise<Agreement>;

  /**
   * Terminates an agreement.
   */
  terminateAgreement(agreement: Agreement, reason?: string): Promise<Agreement>;

  /**
   * Retrieves the state of an agreement based on the provided agreement ID.
   */
  getAgreementState(id: string): Promise<AgreementState>;

  /**
   * Scan the market for offers that match the given specification.
   */
  scan(scanSpecification: ScanSpecification): Observable<ScannedOffer>;
}
