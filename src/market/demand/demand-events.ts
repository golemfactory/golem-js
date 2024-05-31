import { OfferProposal } from "../offer-proposal";

export type OfferProposalReceivedEvent = {
  type: "ProposalReceived";
  proposal: OfferProposal;
  timestamp: Date;
};

export type OfferProposalRejectedEvent = {
  type: "ProposalRejected";
  /** The proposal that the Requestor made */
  counterProposal: OfferProposal;
  reason: string;
  timestamp: Date;
};

export type OfferPropertyQueryReceivedEvent = {
  type: "PropertyQueryReceived";
  timestamp: Date;
};

export type DemandOfferEvent =
  | OfferProposalReceivedEvent
  | OfferProposalRejectedEvent
  | OfferPropertyQueryReceivedEvent;
