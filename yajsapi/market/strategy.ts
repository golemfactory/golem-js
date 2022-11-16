import { Proposal } from "./offer";
import { MarketDecoration } from "ya-ts-client/dist/ya-payment/src/models";

export interface MarketStrategy {
  getDemandDecoration(): MarketDecoration;
  scoreProposal(proposal: Proposal): number;
  // todo
}

export class DefaultMarketStrategy implements MarketStrategy {
  getDemandDecoration(): MarketDecoration {
    return {} as MarketDecoration;
  }

  scoreProposal(proposal: Proposal): number {
    return 0;
  }
}
