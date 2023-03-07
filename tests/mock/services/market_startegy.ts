import { MarketStrategy, Proposal } from "../../../yajsapi/market/index.js";
import { MarketDecoration } from "ya-ts-client/dist/ya-payment/src/models";

export const marketStrategyAlwaysBan: MarketStrategy = {
  scoreProposal(proposal: Proposal): number {
    return -1;
  },
  getDemandDecoration(): MarketDecoration {
    return {} as MarketDecoration;
  },
};
