import { Proposal } from "./offer";

export interface MarketStrategy {
  getDemandDecoration(): string;
  scoreProposal(proposal: Proposal): number;
  // todo
}

export class DefaultMarketStrategy implements MarketStrategy {
  getDemandDecoration(): string {
    return "";
  }

  scoreProposal(proposal: Proposal): number {
    return 0;
  }
}
