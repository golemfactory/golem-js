import { OfferProposal } from "../proposal/offer-proposal";
import { OfferCounterProposal } from "../proposal/offer-counter-proposal";

export type OfferProposalReceivedEvent = {
  type: "ProposalReceived";
  proposal: OfferProposal;
  timestamp: Date;
};

export type OfferCounterProposalRejectedEvent = {
  type: "ProposalRejected";
  counterProposal: OfferCounterProposal;
  reason: string;
  timestamp: Date;
};

export type OfferPropertyQueryReceivedEvent = {
  type: "PropertyQueryReceived";
  timestamp: Date;
};

export type DemandOfferEvent =
  | OfferProposalReceivedEvent
  | OfferCounterProposalRejectedEvent
  | OfferPropertyQueryReceivedEvent;
