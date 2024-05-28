import { OfferProposal } from "../offer-proposal";
import { Agreement } from "./agreement";

export class AgreementCandidate {
  agreement?: Agreement;

  constructor(readonly proposal: OfferProposal) {}
}

export type AgreementSelector = (candidates: AgreementCandidate[]) => Promise<AgreementCandidate>;
