import { AgreementCandidate } from "./service";

export const RandomAgreementSelector = () => async (candidates: AgreementCandidate[]) =>
  candidates[Math.floor(Math.random() * candidates.length)];

export const RandomAgreementSelectorWithPriorityForExistingOnes = () => async (candidates: AgreementCandidate[]) => {
  const existingAgreements = candidates.filter((c) => !c.agreement);
  return existingAgreements.length
    ? existingAgreements[Math.floor(Math.random() * existingAgreements.length)]
    : candidates[Math.floor(Math.random() * candidates.length)];
};

export const BestAgreementSelector =
  (scores: { [providerId: string]: number }) => async (candidates: AgreementCandidate[]) => {
    candidates.sort((a, b) =>
      (scores?.[a.proposal.provider.id] || 0) >= (scores?.[b.proposal.provider.id] || 0) ? 1 : -1
    );
    return candidates[0];
  };
