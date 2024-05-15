import { ProposalFilterNew, OfferProposal } from "../../market";
import { AgreementCandidate, AgreementSelector } from "../../agreement";
import { GolemReputationError } from "./error";
import {
  AgreementSelectorOptions,
  ProposalFilterOptions,
  ReputationConfig,
  ReputationData,
  ReputationPresetName,
  ReputationPresets,
  ReputationProviderEntry,
  ReputationProviderScores,
  ReputationRejectedOperator,
  ReputationRejectedProvider,
  ReputationWeights,
} from "./types";
import { Logger, nullLogger } from "../../shared/utils";
import { getPaymentNetwork } from "../../shared/utils/env";

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
 * Predefined presets for reputation system.
 */
export const REPUTATION_PRESETS: ReputationPresets = {
  /**
   * Preset for short CPU intensive compute tasks.
   */
  compute: {
    proposalFilter: {
      min: 0.5,
      weights: {
        cpuSingleThreadScore: 1,
      },
    },
    agreementSelector: {
      weights: {
        cpuSingleThreadScore: 1,
      },
      topPoolSize: DEFAULT_AGREEMENT_TOP_POOL_SIZE,
    },
  },
  /**
   * Preset for long-running services, where uptime is important.
   */
  service: {
    proposalFilter: {
      min: DEFAULT_PROPOSAL_MIN_SCORE,
      weights: {
        uptime: 0.8,
        cpuMultiThreadScore: 0.2,
      },
    },
    agreementSelector: {
      weights: {
        uptime: 0.5,
        cpuMultiThreadScore: 0.5,
      },
      topPoolSize: DEFAULT_AGREEMENT_TOP_POOL_SIZE,
    },
  },
};

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
    testedProviders: [],
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
   * Default options used when creating proposal filter.
   * @private
   */
  private defaultProposalFilterOptions: ProposalFilterOptions;

  /**
   * Default options used when creating agreement selector.
   * @private
   */
  private defaultAgreementSelectorOptions: AgreementSelectorOptions;

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

    this.defaultProposalFilterOptions = {
      min: DEFAULT_PROPOSAL_MIN_SCORE,
      acceptUnlisted: undefined,
    };
    this.defaultAgreementSelectorOptions = {
      topPoolSize: DEFAULT_AGREEMENT_TOP_POOL_SIZE,
      agreementBonus: 0,
    };

    if (this.config?.preset) {
      this.usePreset(this.config.preset);
    }
  }

  /**
   * Apply preset to current reputation system configuration.
   * @param presetName Preset name to use.
   */
  usePreset(presetName: ReputationPresetName): void {
    const presetConfig = REPUTATION_PRESETS[presetName];
    if (!presetConfig) {
      throw new GolemReputationError(`Reputation preset not found: ${presetName}`);
    }

    if (presetConfig.proposalFilter?.weights) {
      this.setProposalWeights(presetConfig.proposalFilter.weights);
    }

    if (presetConfig.agreementSelector?.weights) {
      this.setAgreementWeights(presetConfig.agreementSelector.weights);
    }

    this.defaultProposalFilterOptions = {
      min: presetConfig.proposalFilter?.min ?? this.defaultProposalFilterOptions.min,
      acceptUnlisted: presetConfig.proposalFilter?.acceptUnlisted, // undefined is meaningful
    };

    this.defaultAgreementSelectorOptions = {
      topPoolSize: presetConfig.agreementSelector?.topPoolSize ?? this.defaultAgreementSelectorOptions.topPoolSize,
      agreementBonus:
        presetConfig.agreementSelector?.agreementBonus ?? this.defaultAgreementSelectorOptions.agreementBonus,
    };
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

    this.data.testedProviders.forEach((entry) => {
      this.providersScoreMap.set(entry.provider.id, entry);
    });

    this.data.rejectedProviders?.forEach((entry) => {
      this.rejectedProvidersMap.set(entry.provider.id, entry);
    });

    this.data.rejectedOperators?.forEach((entry) => {
      this.rejectedOperatorsMap.set(entry.operator.walletAddress, entry);
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
  proposalFilter(opts?: ProposalFilterOptions): ProposalFilterNew {
    return (proposal: OfferProposal) => {
      // Filter out rejected operators.
      const operatorEntry = this.rejectedOperatorsMap.get(proposal.provider.walletAddress);
      if (operatorEntry) {
        this.logger.debug(`Proposal from ${proposal.provider.id} rejected due to rejected operator`, {
          reason: operatorEntry.reason,
          provider: proposal.provider,
        });
        return false;
      }

      // Filter out rejected providers.
      const providerEntry = this.rejectedProvidersMap.get(proposal.provider.id);
      if (providerEntry) {
        this.logger.debug(`Proposal from ${proposal.provider.id} rejected due to rejected provider`, {
          reason: providerEntry.reason,
          provider: proposal.provider,
        });
        return false;
      }

      // Filter based on reputation scores.
      const scoreEntry = this.providersScoreMap.get(proposal.provider.id);
      if (scoreEntry) {
        const min = opts?.min ?? this.defaultProposalFilterOptions.min ?? DEFAULT_PROPOSAL_MIN_SCORE;
        const score = this.calculateScore(scoreEntry.scores, this.proposalWeights);
        this.logger.debug(`Proposal score for ${proposal.provider.id}: ${score} - min ${min}`, {
          provider: proposal.provider,
          scores: scoreEntry.scores,
          weights: this.proposalWeights,
          score,
          min,
        });
        return score >= min;
      }

      this.logger.debug(
        `Proposal from unlisted provider ${proposal.provider.id} (known providers: ${this.data.testedProviders.length})`,
        {
          provider: proposal.provider,
        },
      );

      // Use the acceptUnlisted option if provided, otherwise allow only if there are no known providers.
      return (
        opts?.acceptUnlisted ??
        this.defaultProposalFilterOptions.acceptUnlisted ??
        this.data.testedProviders.length === 0
      );
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
  agreementSelector(opts?: AgreementSelectorOptions): AgreementSelector {
    const poolSize =
      opts?.topPoolSize ?? this.defaultAgreementSelectorOptions.topPoolSize ?? DEFAULT_AGREEMENT_TOP_POOL_SIZE;

    return async (candidates): Promise<AgreementCandidate> => {
      // Cache scores for providers.
      const scoresMap = new Map<string, number>();

      candidates.forEach((c) => {
        const data = this.providersScoreMap.get(c.proposal.provider.id)?.scores ?? {};
        let score = this.calculateScore(data, this.agreementWeights);
        if (c.agreement) score += opts?.agreementBonus ?? this.defaultAgreementSelectorOptions.agreementBonus ?? 0;
        scoresMap.set(c.proposal.provider.id, score);
      });

      const array = this.sortCandidatesByScore(candidates, scoresMap);

      const topPool = Math.min(poolSize, array.length);
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

  /**
   * Based on the current reputation data, calculate a list of providers that meet the minimum score requirement.
   *
   * This method is useful to validate you filter and weights vs the available provider market.
   *
   * @param opts
   */
  calculateProviderPool(opts?: ProposalFilterOptions): ReputationProviderEntry[] {
    const min = opts?.min ?? this.defaultProposalFilterOptions.min ?? DEFAULT_PROPOSAL_MIN_SCORE;
    return this.data.testedProviders.filter((entry) => {
      const score = this.calculateScore(entry.scores, this.proposalWeights);
      return score >= min;
    });
  }

  sortCandidatesByScore(candidates: AgreementCandidate[], scoresMap: Map<string, number>): AgreementCandidate[] {
    const array = Array.from(candidates);

    array.sort((a, b) => {
      const aId = a.proposal.provider.id;
      const bId = b.proposal.provider.id;

      // Get the score values.
      const aScoreValue = scoresMap.get(aId) ?? 0;
      const bScoreValue = scoresMap.get(bId) ?? 0;

      return bScoreValue - aScoreValue;
    });

    return array;
  }
}
