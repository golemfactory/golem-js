import { OfferProposal } from "./proposal/offer-proposal";

/** Default Proposal filter that accept all proposal coming from the market */
export const acceptAll = () => () => true;

/** Proposal filter blocking every offer coming from a provider whose id is in the array */
export const disallowProvidersById = (providerIds: string[]) => (proposal: OfferProposal) =>
  !providerIds.includes(proposal.provider.id);

/** Proposal filter blocking every offer coming from a provider whose name is in the array */
export const disallowProvidersByName = (providerNames: string[]) => (proposal: OfferProposal) =>
  !providerNames.includes(proposal.provider.name);

/** Proposal filter blocking every offer coming from a provider whose name match to the regexp */
export const disallowProvidersByNameRegex = (regexp: RegExp) => (proposal: OfferProposal) =>
  !proposal.provider.name.match(regexp);

/** Proposal filter that only allows offers from a provider whose id is in the array */
export const allowProvidersById = (providerIds: string[]) => (proposal: OfferProposal) =>
  providerIds.includes(proposal.provider.id);

/** Proposal filter that only allows offers from a provider whose name is in the array */
export const allowProvidersByName = (providerNames: string[]) => (proposal: OfferProposal) =>
  providerNames.includes(proposal.provider.name);

/** Proposal filter that only allows offers from a provider whose name match to the regexp */
export const allowProvidersByNameRegex = (regexp: RegExp) => (proposal: OfferProposal) =>
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
export const limitPriceFilter = (priceLimits: PriceLimits) => (proposal: OfferProposal) => {
  return (
    proposal.pricing.cpuSec <= priceLimits.cpuPerSec &&
    proposal.pricing.envSec <= priceLimits.envPerSec &&
    proposal.pricing.start <= priceLimits.start
  );
};
