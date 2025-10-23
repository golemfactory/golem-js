import { MarketApi } from "ya-ts-client";
import { ProviderInfo } from "../agreement";
import { Demand } from "../demand";
import { MarketProposal } from "./market-proposal";
export type OfferProposalFilter = (proposal: OfferProposal) => boolean;
export type PricingInfo = {
    cpuSec: number;
    envSec: number;
    start: number;
};
export type ProposalState = "Initial" | "Draft" | "Rejected" | "Accepted" | "Expired";
export type ProposalDTO = {
    transferProtocol: string[];
    cpuBrand: string;
    cpuCapabilities: string[];
    cpuCores: number;
    cpuThreads: number;
    memory: number;
    storage: number;
    runtimeCapabilities: string[];
    runtimeName: string;
    runtimeVersion: string;
    state: ProposalState;
    /** Non-standardised property, we can't assume it will be always there */
    publicNet?: boolean;
};
/**
 * Entity representing the offer presented by the Provider to the Requestor
 *
 * Issue: The final proposal that gets promoted to an agreement comes from the provider
 * Right now the last time I can access it directly is when I receive the counter from the provider,
 * later it's impossible for me to get it via the API `{"message":"Path deserialize error: Id [2cb0b2820c6142fab5af7a8e90da09f0] has invalid owner type."}`
 *
 * FIXME #yagna should allow obtaining proposals via the API even if I'm not the owner!
 */
export declare class OfferProposal extends MarketProposal {
    readonly demand: Demand;
    readonly issuer = "Provider";
    constructor(model: MarketApi.ProposalDTO, demand: Demand);
    get pricing(): PricingInfo;
    getDto(): ProposalDTO;
    /**
     * Cost estimation based on CPU/h, ENV/h and start prices
     *
     * @param rentHours Number of hours of rental to use for the estimation
     */
    getEstimatedCost(rentHours?: number): number;
    get provider(): ProviderInfo;
    /**
     * Validates if the proposal satisfies basic business rules, is complete and thus safe to interact with
     *
     * Use this method before executing any important logic, to ensure that you're working with correct, complete data
     */
    protected validate(): void | never;
    private getProviderPaymentPlatforms;
}
