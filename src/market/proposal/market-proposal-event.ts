import { OfferProposal } from "./offer-proposal";
import { OfferCounterProposal } from "./offer-counter-proposal";

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

export type MarketProposalEvent =
  | OfferProposalReceivedEvent
  | OfferCounterProposalRejectedEvent
  | OfferPropertyQueryReceivedEvent;
