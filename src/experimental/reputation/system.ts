import { Proposal, ProposalFilter } from "../../market";
import { AgreementCandidate, AgreementSelector } from "../../agreement";
import { GolemReputationError } from "./error";
import {
  AgreementSelectorOption,
  ProposalFilterOptions,
  ReputationConfig,
  ReputationData,
  ReputationProviderEntry,
  ReputationProviderScores,
  ReputationRejectedOperator,
  ReputationRejectedProvider,
  ReputationWeights,
} from "./types";
import { Logger, nullLogger } from "../../utils";
import { getPaymentNetwork } from "../../utils/env";

/**
 * Default minimum score for proposals.
 * @experimental
 */
export const DEFAULT_PROPOSAL_MIN_SCORE = 0.8;

/**
 * Default weights used to calculate the score for proposals.
 * @experimental
 */
export const DEFAULT_PROPOSAL_WEIGHTS: ReputationWeights = {
  uptime: 0.5,
  successRate: 0.5,
} as const;

/**
 * Default weights used to calculate the score for agreements.
 * @experimental
 */
export const DEFAULT_AGREEMENT_WEIGHTS: ReputationWeights = {
  uptime: 0.5,
  successRate: 0.5,
} as const;

/**
 * Default reputation service URL.
 * @experimental
 */
export const DEFAULT_REPUTATION_URL = "https://reputation.dev-test.golem.network/v2/providers/scores";

/**
 * The number of top scoring providers to consider when selecting an agreement.
 *
 * Default for `topPoolSize` agreement selector option.
 */
export const DEFAULT_AGREEMENT_TOP_POOL_SIZE = 2;

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
export class ReputationSystem {
  /**
   * Reputation data.
   */
  private data: ReputationData = {
    providers: [],
  };

  /**
   * Weights used to calculate the score for proposals.
   */
  private proposalWeights: ReputationWeights = DEFAULT_PROPOSAL_WEIGHTS;

  /**
   * Weights used to calculate the score for agreements.
   */
  private agreementWeights: ReputationWeights = DEFAULT_AGREEMENT_WEIGHTS;

  /**
   * The payment network currently used.
   */
  public readonly paymentNetwork: string;

  /**
   * Map of provider IDs to their reputation data.
   */
  private readonly providersScoreMap = new Map<string, ReputationProviderEntry>();

  /**
   * Map of provider IDs to their rejected status.
   * @private
   */
  private readonly rejectedProvidersMap = new Map<string, ReputationRejectedProvider>();

  /**
   * Map of operators (by wallet address) to their rejected status.
   * @private
   */
  private readonly rejectedOperatorsMap = new Map<string, ReputationRejectedOperator>();

  /**
   * Reputation service URL.
   */
  private readonly url: string;

  /**
   * Local logger instance.
   * @private
   */
  private readonly logger: Logger;

  /**
   * Create a new reputation system client and fetch the reputation data.
   */
  public static async create(config?: ReputationConfig): Promise<ReputationSystem> {
    const system = new ReputationSystem(config);
    await system.fetchData();
    return system;
  }

  constructor(private config?: ReputationConfig) {
    this.url = this.config?.url ?? DEFAULT_REPUTATION_URL;
    this.logger = this.config?.logger?.child("reputation") ?? nullLogger();
    this.paymentNetwork = this.config?.paymentNetwork ?? getPaymentNetwork();
  }

  /**
   * Set reputation data.
   *
   * This is useful if you want to cache the date locally, or you have an alternative source of data.
   */
  setData(data: ReputationData): void {
    this.data = data;
    this.providersScoreMap.clear();
    this.rejectedProvidersMap.clear();
    this.rejectedOperatorsMap.clear();

    this.data.providers.forEach((entry) => {
      this.providersScoreMap.set(entry.providerId, entry);
    });

    this.data.rejectedProviders?.forEach((entry) => {
      this.rejectedProvidersMap.set(entry.providerId, entry);
    });

    this.data.rejectedOperators?.forEach((entry) => {
      this.rejectedOperatorsMap.set(entry.wallet, entry);
    });
  }

  /**
   * Returns current reputation data.
   */
  getData(): ReputationData {
    return this.data;
  }

  /**
   * Fetch data from the reputation service.
   */
  async fetchData(): Promise<void> {
    let result: Response;

    try {
      // Add payment network to the URL.
      const url = new URL(this.url);
      url.searchParams.set("network", this.paymentNetwork);
      result = await fetch(url);
    } catch (e) {
      throw new GolemReputationError("Failed to fetch reputation data", e);
    }

    if (result.ok) {
      try {
        const data = await result.json();
        this.setData(data);
      } catch (e) {
        throw new GolemReputationError("Failed to fetch reputation data: Invalid data", e);
      }
    } else {
      throw new GolemReputationError(`Failed to fetch reputation data: ${result.statusText}`);
    }
  }

  /**
   * Set weights used to calculate the score for proposals.
   */
  setProposalWeights(weights: ReputationWeights): void {
    this.proposalWeights = weights;
  }

  /**
   * Returns current proposal weights.
   */
  getProposalWeights(): ReputationWeights {
    return this.proposalWeights;
  }

  /**
   * Set weights used to calculate the score for agreements.
   */
  setAgreementWeights(weights: ReputationWeights): void {
    this.agreementWeights = weights;
  }

  /**
   * Returns current agreement weights.
   */
  getAgreementWeights(): ReputationWeights {
    return this.agreementWeights;
  }

  /**
   * Returns scores for a provider or undefined if the provider is unlisted.
   * @param providerId
   */
  getProviderScores(providerId: string): ReputationProviderScores | undefined {
    return this.providersScoreMap.get(providerId)?.scores;
  }

  /**
   * Returns a proposal filter that can be used to filter out providers with low reputation scores.
   * @param opts
   */
  proposalFilter(opts?: ProposalFilterOptions): ProposalFilter {
    return (proposal: Proposal) => {
      // Filter out rejected operators.
      const operatorEntry = this.rejectedOperatorsMap.get(proposal.provider.walletAddress);
      if (operatorEntry) {
        this.logger.debug(`Proposal from ${proposal.provider.id} rejected due to rejected operator`, {
          reason: operatorEntry.reason,
          walletAddress: proposal.provider.walletAddress,
          providerId: proposal.provider.id,
          providerName: proposal.provider.name,
        });
        return false;
      }

      // Filter out rejected providers.
      const providerEntry = this.rejectedProvidersMap.get(proposal.provider.id);
      if (providerEntry) {
        this.logger.debug(`Proposal from ${proposal.provider.id} rejected due to rejected provider`, {
          reason: providerEntry.reason,
          walletAddress: proposal.provider.walletAddress,
          providerId: proposal.provider.id,
          providerName: proposal.provider.name,
        });
        return false;
      }

      // Filter based on reputation scores.
      const scoreEntry = this.providersScoreMap.get(proposal.provider.id);
      if (scoreEntry) {
        const min = opts?.min ?? DEFAULT_PROPOSAL_MIN_SCORE;
        const score = this.calculateScore(scoreEntry.scores, this.proposalWeights);
        this.logger.debug(`Proposal score for ${proposal.provider.id}: ${score} - min ${min}`, {
          walletAddress: proposal.provider.walletAddress,
          providerId: proposal.provider.id,
          providerName: proposal.provider.name,
          scores: scoreEntry.scores,
          weights: this.proposalWeights,
          score,
          min,
        });
        return score >= min;
      }

      this.logger.debug(
        `Proposal from unlisted provider ${proposal.provider.id} (known providers: ${this.data.providers.length})`,
      );

      // Use the acceptUnlisted option if provided, otherwise allow only if there are no known providers.
      return opts?.acceptUnlisted ?? this.data.providers.length === 0;
    };
  }

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
  agreementSelector(opts?: AgreementSelectorOption): AgreementSelector {
    return async (candidates): Promise<AgreementCandidate> => {
      const array = Array.from(candidates);
      // Cache scores for providers.
      const scoresMap = new Map<string, number>();

      // Sort the array by score
      array.sort((a, b) => {
        const aId = a.proposal.provider.id;
        const bId = b.proposal.provider.id;

        const aScoreData = this.providersScoreMap.get(aId)?.scores ?? {};
        const bScoreData = this.providersScoreMap.get(bId)?.scores ?? {};

        // Get the score values.
        let aScoreValue = scoresMap.get(aId) ?? this.calculateScore(aScoreData, this.agreementWeights);
        let bScoreValue = scoresMap.get(bId) ?? this.calculateScore(bScoreData, this.agreementWeights);

        // Store score if not already stored.
        if (!scoresMap.has(aId)) scoresMap.set(aId, aScoreValue);
        if (!scoresMap.has(bId)) scoresMap.set(bId, bScoreValue);

        // Add bonus for existing agreements.
        if (a.agreement) aScoreValue += opts?.agreementBonus ?? 0;
        if (b.agreement) bScoreValue += opts?.agreementBonus ?? 0;

        return bScoreValue - aScoreValue;
      });

      const topPool = Math.min(opts?.topPoolSize ?? DEFAULT_AGREEMENT_TOP_POOL_SIZE, array.length);
      const index = topPool === 1 ? 0 : Math.floor(Math.random() * topPool);

      return array[index];
    };
  }

  /**
   * Calculate a normalized score based on the given scores and weights.
   * @param scores
   * @param weights
   */
  calculateScore(scores: Partial<ReputationProviderScores>, weights: ReputationWeights): number {
    let totalWeight = 0;
    let score = 0;

    (Object.keys(weights) as (keyof ReputationProviderScores)[]).forEach((key) => {
      const weight = weights[key] ?? 0;
      const value = scores[key] ?? 0;

      totalWeight += weight;
      score += weight * value;
    });

    // Return normalized score.
    return score / totalWeight;
  }
}
