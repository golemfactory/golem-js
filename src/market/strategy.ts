import { Proposal } from "./proposal";

/** Default Proposal filter that accept all proposal coming from the market */
export const acceptAllProposalFilter = () => async () => true;

/** Proposal filter blocking every offer coming from a provider whose id is in the array */
export const blackListProposalIdsFilter = (blackListIds: string[]) => async (proposal: Proposal) =>
  !blackListIds.includes(proposal.issuerId);

/** Proposal filter blocking every offer coming from a provider whose name is in the array */
export const blackListProposalNamesFilter = (blackListNames: string[]) => async (proposal: Proposal) =>
  !blackListNames.includes(proposal.provider.name);

/** Proposal filter blocking every offer coming from a provider whose name match to the regexp */
export const blackListProposalRegexpFilter = (regexp: RegExp) => async (proposal: Proposal) =>
  !proposal.provider.name.match(regexp);

/** Proposal filter that only allows offers from a provider whose id is in the array */
export const whiteListProposalIdsFilter = (whiteListIds: string[]) => async (proposal: Proposal) =>
  whiteListIds.includes(proposal.issuerId);

/** Proposal filter that only allows offers from a provider whose name is in the array */
export const whiteListProposalNamesFilter = (whiteListNames: string[]) => async (proposal: Proposal) =>
  whiteListNames.includes(proposal.provider.name);

/** Proposal filter that only allows offers from a provider whose name match to the regexp */
export const whiteListProposalRegexpFilter = (regexp: RegExp) => async (proposal: Proposal) =>
  !!proposal.provider.name.match(regexp);

export type PriceLimits = {
  start: number;
  cpuPerSec: number;
  envPerSec: number;
};

/**
 * Proposal filter only allowing offers that do not exceed the defined usage
 *
 * @param priceLimits.start The maximum start price in GLM
 * @param priceLimits.cpuPerSec The maximum price for CPU usage in GLM/s
 * @param priceLimits.envPerSec The maximum price for the duration of the activity in GLM/s
 */
export const limitPriceFilter = (priceLimits: PriceLimits) => async (proposal: Proposal) => {
  return (
    proposal.pricing.cpuSec <= priceLimits.cpuPerSec &&
    proposal.pricing.envSec <= priceLimits.envPerSec &&
    proposal.pricing.start <= priceLimits.start
  );
};
