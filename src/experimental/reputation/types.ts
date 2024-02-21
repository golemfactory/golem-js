import { Logger } from "../../utils";

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
  // Percentage of successful tasks in the last "period" (last N test runs?)
  successRate: number;
  // Ping percentage that got responses.
  uptime: number;
}

/**
 * Reputation provider entry.
 * @experimental
 */
export interface ReputationProviderEntry {
  providerId: string;
  scores: ReputationProviderScores;
}

/**
 * Reputation data.
 * @experimental
 */
export interface ReputationData {
  providers: ReputationProviderEntry[];
  rejected: unknown[];
}

/**
 * Options for the proposal filter.
 * @experimental
 */
export interface ProposalFilterOptions {
  /**
   * Should providers with no reputation data be accepted.
   *
   * Default is false
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
export interface AgreementSelectorOption {
  /**
   * Should a provider without reputation data be used if there are no alternatives.
   *
   * Default is false
   */
  allowFallback?: boolean;

  /**
   * Pick that number of top-rated providers and pick a random one. Default: 1
   */
  topPick?: number;
}

/**
 * Weights used to calculate the score for providers.
 */
export type ReputationWeights = Partial<ReputationProviderScores>;

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
   * Logger to use.
   */
  logger?: Logger;
}
