import { Logger } from "../utils/index.js";
import { AgreementCandidate, ProposalDTO } from "../agreement/service.js";

export interface MarketStrategy {
  checkProposal(proposal: ProposalDTO): Promise<boolean>;
  getBestAgreementCandidate(candidates: AgreementCandidate[]): Promise<AgreementCandidate>;
}

export class DummyMarketStrategy implements MarketStrategy {
  constructor(readonly logger?: Logger) {}
  async checkProposal(proposal: ProposalDTO): Promise<boolean> {
    return Promise.resolve(true);
  }

  async getBestAgreementCandidate(candidates: AgreementCandidate[]): Promise<AgreementCandidate> {
    return candidates[0];
  }
}
