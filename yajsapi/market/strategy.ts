import { Logger } from "../utils/index.js";

export interface MarketStrategy {
  checkProposal(proposal: Proposal): Promise<boolean>;
  getBestAgreementCandidate(candidates: AgreementCandidate[]): Promise<AgreementCandidate>;
}
export interface AgreementCandidate {
  agreement?: Agreement;
  proposal: Proposal;
}

export interface Agreement {
  id: string;
  provider: { id: string; name: string };
}
export interface Proposal {
  id: string;
  issuerId: string;
  properties: object;
  constraints: string;
}

export class DummyMarketStrategy implements MarketStrategy {
  constructor(readonly logger?: Logger) {}
  async checkProposal(proposal: Proposal): Promise<boolean> {
    return true;
  }

  async getBestAgreementCandidate(candidates: AgreementCandidate[]): Promise<AgreementCandidate> {
    return candidates[0];
  }
}
