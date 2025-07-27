import { OfferProposal } from "./offer-proposal";
export type ProposalsBatchOptions = {
    /** The minimum number of proposals after which it will be possible to return the collection */
    minBatchSize?: number;
    /** The maximum waiting time for collecting proposals after which it will be possible to return the collection */
    releaseTimeoutMs?: number;
};
/**
 * Proposals Batch aggregates initial proposals and returns a set grouped by the provider's key
 * to avoid duplicate offers issued by the provider.
 */
export declare class ProposalsBatch {
    /** Batch of proposals mapped by provider key and related set of initial proposals */
    private batch;
    /** Lock used to synchronize adding and getting proposals from the batch */
    private lock;
    private config;
    constructor(options?: ProposalsBatchOptions);
    /**
     * Add proposal to the batch grouped by provider key
     * which consist of providerId, cores, threads, mem and storage
     */
    addProposal(proposal: OfferProposal): Promise<void>;
    /**
     * Returns the batched proposals from the internal buffer and empties it
     */
    getProposals(): Promise<OfferProposal[]>;
    /**
     * Waits for the max amount time for batching or max batch size to be reached before it makes sense to process events
     *
     * Used to flow-control the consumption of the proposal events from the batch.
     * The returned promise resolves when it is time to process the buffered proposal events.
     */
    waitForProposals(): Promise<void>;
    /**
     * Selects the best proposal from the set according to the lowest price and the youngest proposal age
     */
    private getBestProposal;
    /**
     * Provider key used to group proposals so that they can be distinguished based on ID and hardware configuration
     */
    private getProviderKey;
}
