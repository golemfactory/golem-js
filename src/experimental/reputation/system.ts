import { Proposal, ProposalFilter } from "../../market";
import { AgreementSelector } from "../../agreement";
import { GolemReputationError } from "./error";
import {
  AgreementSelectorOption,
  ProposalFilterOptions,
  ReputationConfig,
  ReputationData,
  ReputationProviderEntry,
  ReputationProviderScores,
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
export const DEFAULT_REPUTATION_URL = "https://reputation.dev-test.golem.network/v1/providers/scores";

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
    rejected: [], // Currently unused.
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
  private readonly dataMap = new Map<string, ReputationProviderEntry>();

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
    this.dataMap.clear();
    this.data.providers.forEach((entry) => {
      this.dataMap.set(entry.providerId, entry);
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
   * Returns a proposal filter that can be used to filter out providers with low reputation scores.
   * @param opts
   */
  proposalFilter(opts?: ProposalFilterOptions): ProposalFilter {
    return (proposal: Proposal) => {
      const entry = this.dataMap.get(proposal.provider.id);
      if (entry) {
        const score = this.calculateScore(entry.scores, this.proposalWeights);
        this.logger.debug(
          `Proposal score for ${proposal.id}: ${score} - min ${opts?.min ?? DEFAULT_PROPOSAL_MIN_SCORE}`,
        );
        return score >= (opts?.min ?? DEFAULT_PROPOSAL_MIN_SCORE);
      }

      this.logger.debug(
        `Proposal from unlisted provider ${proposal.provider.id} (known providers: ${this.data.providers.length})`,
      );

      // Use the acceptUnlisted option by default, otherwise allow only if there are no known providers.
      return opts?.acceptUnlisted ?? this.data.providers.length === 0;
    };
  }

  /**
   * Currently not implemented.
   * @param opts
   */
  agreementSelector(opts?: AgreementSelectorOption): AgreementSelector {
    throw new GolemReputationError("Not implemented" + opts);
  }

  /**
   * Calculate a normalized score based on the given scores and weights.
   * @param scores
   * @param weights
   */
  calculateScore(scores: ReputationProviderScores, weights: ReputationWeights): number {
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
