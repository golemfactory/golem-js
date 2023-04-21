import { MarketStrategy, Proposal } from "../../../yajsapi/market/index.js";
import { MarketDecoration } from "ya-ts-client/dist/ya-payment/src/models";
import { AgreementCandidate, ProposalDTO } from "../../../yajsapi/agreement/service";

export const marketStrategyAlwaysBan: MarketStrategy = {
  async checkProposal(proposal: ProposalDTO): Promise<boolean> {
    return true;
  },
  async getBestAgreementCandidate(candidates: AgreementCandidate[]): Promise<AgreementCandidate> {
    return candidates[0];
  },
};
