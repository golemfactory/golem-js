import { OfferProposal } from "./proposal/offer-proposal";
/** Default Proposal filter that accept all proposal coming from the market */
export declare const acceptAll: () => () => boolean;
/** Proposal filter blocking every offer coming from a provider whose id is in the array */
export declare const disallowProvidersById: (providerIds: string[]) => (proposal: OfferProposal) => boolean;
/** Proposal filter blocking every offer coming from a provider whose name is in the array */
export declare const disallowProvidersByName: (providerNames: string[]) => (proposal: OfferProposal) => boolean;
/** Proposal filter blocking every offer coming from a provider whose name match to the regexp */
export declare const disallowProvidersByNameRegex: (regexp: RegExp) => (proposal: OfferProposal) => boolean;
/** Proposal filter that only allows offers from a provider whose id is in the array */
export declare const allowProvidersById: (providerIds: string[]) => (proposal: OfferProposal) => boolean;
/** Proposal filter that only allows offers from a provider whose name is in the array */
export declare const allowProvidersByName: (providerNames: string[]) => (proposal: OfferProposal) => boolean;
/** Proposal filter that only allows offers from a provider whose name match to the regexp */
export declare const allowProvidersByNameRegex: (regexp: RegExp) => (proposal: OfferProposal) => boolean;
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
export declare const limitPriceFilter: (priceLimits: PriceLimits) => (proposal: OfferProposal) => boolean;
