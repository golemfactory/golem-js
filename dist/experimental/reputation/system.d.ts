import { OfferProposalFilter, OfferProposal, OfferProposalSelector } from "../../market";
import { ProposalSelectorOptions, ProposalFilterOptions, ReputationConfig, ReputationData, ReputationPresetName, ReputationPresets, ReputationProviderEntry, ReputationProviderScores, ReputationWeights } from "./types";
/**
 * Default minimum score for proposals.
 * @experimental
 */
export declare const DEFAULT_PROPOSAL_MIN_SCORE = 0.8;
/**
 * Default weights used to calculate the score for proposals.
 * @experimental
 */
export declare const DEFAULT_PROPOSAL_WEIGHTS: ReputationWeights;
/**
 * Default weights used to calculate the score for agreements.
 * @experimental
 */
export declare const DEFAULT_AGREEMENT_WEIGHTS: ReputationWeights;
/**
 * Default reputation service URL.
 * @experimental
 */
export declare const DEFAULT_REPUTATION_URL = "https://reputation.golem.network/v2/providers/scores";
/**
 * The number of top scoring providers to consider when selecting an agreement.
 *
 * Default for `topPoolSize` agreement selector option.
 */
export declare const DEFAULT_AGREEMENT_TOP_POOL_SIZE = 2;
/**
 * Predefined presets for reputation system.
 */
export declare const REPUTATION_PRESETS: ReputationPresets;
/**
 * Reputation system client.
 *
 * This class is responsible for fetching and applying reputation data to Golem SDK's market management class.
 *
 * Currently, it includes a proposal filter you can use to filter out providers with low reputation scores.
 *
 * Reputation data is gathered by the following project: https://github.com/golemfactory/reputation-auditor
 *
 * You can adjust the weights used to calculate the score for proposals by using the `setProposalWeights` method.
 *
 * NOTE: This class is currently experimental and subject to change.
 *
 * NOTE: Only providers from polygon network are being tested, so using this class on testnet will not work.
 *
 * @experimental
 */
export declare class ReputationSystem {
    private config?;
    /**
     * Reputation data.
     */
    private data;
    /**
     * Weights used to calculate the score for proposals.
     */
    private proposalWeights;
    /**
     * Weights used to calculate the score for agreements.
     */
    private agreementWeights;
    /**
     * The payment network currently used.
     */
    readonly paymentNetwork: string;
    /**
     * Map of provider IDs to their reputation data.
     */
    private readonly providersScoreMap;
    /**
     * Map of provider IDs to their rejected status.
     * @private
     */
    private readonly rejectedProvidersMap;
    /**
     * Map of operators (by wallet address) to their rejected status.
     * @private
     */
    private readonly rejectedOperatorsMap;
    /**
     * Reputation service URL.
     */
    private readonly url;
    /**
     * Local logger instance.
     * @private
     */
    private readonly logger;
    /**
     * Default options used when creating proposal filter.
     * @private
     */
    private defaultProposalFilterOptions;
    /**
     * Default options used when creating agreement selector.
     * @private
     */
    private defaultAgreementSelectorOptions;
    /**
     * Create a new reputation system client and fetch the reputation data.
     */
    static create(config?: ReputationConfig): Promise<ReputationSystem>;
    constructor(config?: ReputationConfig | undefined);
    /**
     * Apply preset to current reputation system configuration.
     * @param presetName Preset name to use.
     */
    usePreset(presetName: ReputationPresetName): void;
    /**
     * Set reputation data.
     *
     * This is useful if you want to cache the date locally, or you have an alternative source of data.
     */
    setData(data: ReputationData): void;
    /**
     * Returns current reputation data.
     */
    getData(): ReputationData;
    /**
     * Fetch data from the reputation service.
     */
    fetchData(): Promise<void>;
    /**
     * Set weights used to calculate the score for proposals.
     */
    setProposalWeights(weights: ReputationWeights): void;
    /**
     * Returns current proposal weights.
     */
    getProposalWeights(): ReputationWeights;
    /**
     * Set weights used to calculate the score for agreements.
     */
    setAgreementWeights(weights: ReputationWeights): void;
    /**
     * Returns current agreement weights.
     */
    getAgreementWeights(): ReputationWeights;
    /**
     * Returns scores for a provider or undefined if the provider is unlisted.
     * @param providerId
     */
    getProviderScores(providerId: string): ReputationProviderScores | undefined;
    /**
     * Returns a proposal filter that can be used to filter out providers with low reputation scores.
     * @param opts
     */
    offerProposalFilter(opts?: ProposalFilterOptions): OfferProposalFilter;
    /**
     * Returns an agreement selector that can be used to select providers based on their reputation scores.
     *
     * The outcome of this function is determined by current provider scores and the agreement weights set.
     *
     * For best results, make sure you test the performance or stability of your workload using different weights.
     *
     * @see setAgreementWeights
     *
     * @param opts
     */
    offerProposalSelector(opts?: ProposalSelectorOptions): OfferProposalSelector;
    /**
     * Calculate a normalized score based on the given scores and weights.
     * @param scores
     * @param weights
     */
    calculateScore(scores: Partial<ReputationProviderScores>, weights: ReputationWeights): number;
    /**
     * Based on the current reputation data, calculate a list of providers that meet the minimum score requirement.
     *
     * This method is useful to validate you filter and weights vs the available provider market.
     *
     * @param opts
     */
    calculateProviderPool(opts?: ProposalFilterOptions): ReputationProviderEntry[];
    sortCandidatesByScore(proposals: OfferProposal[], scoresMap: Map<string, number>): OfferProposal[];
}
