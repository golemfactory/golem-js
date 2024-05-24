import { Logger } from "../../shared/utils";
import { ProviderInfo } from "../../market/agreement";

/**
 * Set of normalized scores for a provider.
 *
 * All values are between 0 and 1.
 *
 * Higher score is better.
 *
 * @experimental
 */
export interface ReputationProviderScores {
  /** Percentage of successful tasks in the last "period" (last N test runs?) */
  successRate: number;
  /** Ping percentage that got responses. */
  uptime: number;
  /** CPU single threaded benchmark score. */
  cpuSingleThreadScore: number;
  /** CPU multi-thread benchmark score. */
  cpuMultiThreadScore: number;
}

/**
 * Reputation provider entry.
 * @experimental
 */
export interface ReputationProviderEntry {
  provider: ProviderInfo;
  scores: ReputationProviderScores;
}

/**
 * Information about a rejected operator.
 * @experimental
 */
export interface ReputationRejectedOperator {
  operator: {
    walletAddress: string;
  };
  reason?: string;
}

/**
 * Information about a rejected provider.
 * @experimental
 */
export interface ReputationRejectedProvider {
  provider: ProviderInfo;
  reason?: string;
}

/**
 * Information about untested provider.
 * @experimental
 */
export interface ReputationUntestedProvider {
  provider: ProviderInfo;
  scores: {
    uptime: number;
  };
}

/**
 * Reputation data.
 * @experimental
 */
export interface ReputationData {
  testedProviders: ReputationProviderEntry[];
  rejectedProviders?: ReputationRejectedProvider[];
  rejectedOperators?: ReputationRejectedOperator[];
  untestedProviders?: ReputationUntestedProvider[];
}

/**
 * Options for the proposal filter.
 * @experimental
 */
export interface ProposalFilterOptions {
  /**
   * Should providers with no reputation data be accepted.
   *
   * Default is false if there are listed providers, true if there are no listed providers.
   */
  acceptUnlisted?: boolean;

  /**
   * Minimum weighted score a provider on the list needs to have in order to not get rejected.
   *
   * Default is `DEFAULT_PROPOSAL_MIN_SCORE`.
   */
  min?: number;
}

/**
 * Options for the agreement selector.
 * @experimental
 */
export interface AgreementSelectorOptions {
  /**
   * The size of top provider pool used to pick a random one.
   *
   * If you want to just use the best available one, set this to 1.
   *
   * Default is `DEFAULT_AGREEMENT_TOP_POOL_SIZE`.
   */
  topPoolSize?: number;

  /**
   * Add extra score to provider if it has an existing agreement.
   *
   * Default is 0.
   */
  agreementBonus?: number;
}

/**
 * Weights used to calculate the score for providers.
 * @experimental
 */
export type ReputationWeights = Partial<ReputationProviderScores>;

/**
 * Mixin for objects with reputation weights.
 * @experimental
 */
export interface ReputationWeightsMixin {
  weights?: ReputationWeights;
}

/**
 * Preset configuration for reputation system.
 *
 * @experimental
 */
export interface ReputationPreset {
  proposalFilter?: ProposalFilterOptions & ReputationWeightsMixin;
  agreementSelector?: AgreementSelectorOptions & ReputationWeightsMixin;
}

/**
 * Interface for predefined reputation presets.
 *
 * @experimental
 */
export interface ReputationPresets {
  compute: ReputationPreset;
  service: ReputationPreset;
}

/**
 * Names of predefined reputation presets.
 *
 * @experimental
 */
export type ReputationPresetName = keyof ReputationPresets;

/**
 * Configuration for ReputationSystem class.
 *
 * @experimental
 */
export interface ReputationConfig {
  /**
   * Reputation service URL
   */
  url?: string;

  /**
   * Network to query data for.
   *
   * This is the main filter for the data.
   *
   * You can leave it empty if you are controlling the payment network through `PAYMENT_NETWORK` environment variable.
   */
  paymentNetwork?: string;

  /**
   * Logger to use.
   */
  logger?: Logger;

  preset?: ReputationPresetName;
}
