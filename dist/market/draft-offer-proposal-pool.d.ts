import { OfferProposal, OfferProposalFilter } from "./proposal";
import { EventEmitter } from "eventemitter3";
import { Logger } from "../shared/utils";
import { Observable, Subscription } from "rxjs";
export type OfferProposalSelector = (proposals: OfferProposal[]) => OfferProposal;
export interface ProposalPoolOptions {
    /**
     * A user-defined function that will be used by {@link DraftOfferProposalPool.acquire} to pick the best fitting offer proposal from available ones
     */
    selectOfferProposal?: OfferProposalSelector;
    /**
     * User defined filter function which will determine if the offer proposal is valid for use.
     *
     * Offer proposals are validated before being handled to the caller of {@link DraftOfferProposalPool.acquire}
     */
    validateOfferProposal?: OfferProposalFilter;
    /**
     * Min number of proposals in pool so that it can be considered as ready to use
     *
     * @default 0
     */
    minCount?: number;
    logger?: Logger;
}
export interface ProposalPoolEvents {
    added: (event: {
        proposal: OfferProposal;
    }) => void;
    removed: (event: {
        proposal: OfferProposal;
    }) => void;
    acquired: (event: {
        proposal: OfferProposal;
    }) => void;
    released: (event: {
        proposal: OfferProposal;
    }) => void;
    cleared: () => void;
}
/**
 * Pool of draft offer proposals that are ready to be promoted to agreements with Providers
 *
 * Reaching this pool means that the related initial proposal which was delivered by Yagna in response
 * to the subscription with the Demand has been fully negotiated between the Provider and Requestor.
 *
 * This pool should contain only offer proposals that can be used to pursue the final Agreement between the
 * parties.
 *
 * Technically, the "market" part of you application should populate this pool with such offer proposals.
 */
export declare class DraftOfferProposalPool {
    private options?;
    readonly events: EventEmitter<ProposalPoolEvents, any>;
    private logger;
    private acquireQueue;
    /** {@link ProposalPoolOptions.minCount} */
    private readonly minCount;
    /** {@link ProposalPoolOptions.selectOfferProposal} */
    private readonly selectOfferProposal;
    /** {@link ProposalPoolOptions.validateOfferProposal} */
    private readonly validateOfferProposal;
    /**
     * The proposals that were not yet leased to anyone and are available for lease
     */
    private available;
    /**
     * The proposal that were already leased to someone and shouldn't be leased again
     */
    private leased;
    constructor(options?: ProposalPoolOptions | undefined);
    /**
     * Pushes the provided proposal to the list of proposals available for lease
     */
    add(proposal: OfferProposal): void;
    /**
     * Attempts to obtain a single proposal from the pool
     * @param signalOrTimeout - the timeout in milliseconds or an AbortSignal that will be used to cancel the acquiring
     */
    acquire(signalOrTimeout?: number | AbortSignal): Promise<OfferProposal>;
    /**
     * Releases the proposal back to the pool
     *
     * Validates if the proposal is still usable before putting it back to the list of available ones
     * @param proposal
     */
    release(proposal: OfferProposal): void;
    remove(proposal: OfferProposal): void;
    /**
     * Returns the number of all items in the pool (available + leased out)
     */
    count(): number;
    /**
     * Returns the number of items that are possible to lease from the pool
     */
    availableCount(): number;
    /**
     * Returns the number of items that were leased out of the pool
     */
    leasedCount(): number;
    /**
     * Tells if the pool is ready to take items from
     */
    isReady(): boolean;
    /**
     * Clears the pool entirely
     */
    clear(): Promise<void>;
    protected removeFromAvailable(proposal: OfferProposal): void;
    readFrom(source: Observable<OfferProposal>): Subscription;
}
