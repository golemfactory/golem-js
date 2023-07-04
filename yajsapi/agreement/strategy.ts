import { AgreementCandidate } from "./service";

/** Default selector that selects a random provider from the pool */
export const randomAgreementSelector = () => async (candidates: AgreementCandidate[]) =>
  candidates[Math.floor(Math.random() * candidates.length)];

/** Selector selecting a random provider from the pool, but giving priority to those who already have a confirmed agreement and deployed activity */
export const randomAgreementSelectorWithPriorityForExistingOnes = () => async (candidates: AgreementCandidate[]) => {
  const existingAgreements = candidates.filter((c) => !c.agreement);
  return existingAgreements.length
    ? existingAgreements[Math.floor(Math.random() * existingAgreements.length)]
    : candidates[Math.floor(Math.random() * candidates.length)];
};

/** Selector selecting the provider according to the provided list of scores */
export const bestAgreementSelector =
  (scores: { [providerId: string]: number }) => async (candidates: AgreementCandidate[]) => {
    candidates.sort((a, b) =>
      (scores?.[a.proposal.provider.id] || 0) >= (scores?.[b.proposal.provider.id] || 0) ? 1 : -1
    );
    return candidates[0];
  };
