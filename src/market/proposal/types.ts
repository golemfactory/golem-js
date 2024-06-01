import { OfferProposal } from "./offer-proposal";
import { Demand } from "../demand";
import { MarketProposal } from "./market-proposal";
import { OfferCounterProposal } from "./offer-counter-proposal";

export function isOfferProposal(proposal: MarketProposal): proposal is OfferProposal {
  return proposal.issuer === "Provider";
}

export function isOfferCounterProposal(proposal: MarketProposal): proposal is OfferCounterProposal {
  return proposal.issuer === "Requestor";
}

export interface IProposalRepository {
  add(proposal: MarketProposal): MarketProposal;

  getById(id: string): MarketProposal | undefined;

  getByDemandAndId(demand: Demand, id: string): Promise<MarketProposal>;
}
