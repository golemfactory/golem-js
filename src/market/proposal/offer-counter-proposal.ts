import { MarketProposal } from "./market-proposal";
import { MarketApi } from "ya-ts-client";

export class OfferCounterProposal extends MarketProposal {
  public readonly issuer = "Requestor";

  constructor(model: MarketApi.ProposalDTO) {
    super(model);
  }

  protected validate(): void {
    return;
  }
}
