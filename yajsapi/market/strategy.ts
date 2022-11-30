import { Proposal } from "../market";
import { MarketDecoration } from "ya-ts-client/dist/ya-payment/src/models";
import { BillingScheme, ComLinear, Counter, PRICE_MODEL, PriceModel } from "../props/com";
import { Logger } from "../utils";

export const SCORE_NEUTRAL = 0.0;
export const SCORE_REJECTED = -1.0;
export const SCORE_TRUSTED = 100.0;

export interface ComputationHistory {
  isProviderLastAgreementRejected: (providerId: string) => boolean;
}

export interface MarketStrategy {
  getDemandDecoration(): MarketDecoration;
  scoreProposal(proposal: Proposal): number;
}

export class DefaultMarketStrategy implements MarketStrategy {
  private defaultStrategy: MarketStrategy;
  constructor(computationHistory: ComputationHistory, logger?: Logger) {
    this.defaultStrategy = new DecreaseScoreForUnconfirmedAgreementMarketStrategy(
      new LeastExpensiveLinearPayuMarketStrategy(
        60,
        1.0,
        new Map([
          [Counter.TIME, 0.1],
          [Counter.CPU, 0.2],
        ]),
        logger
      ),
      0.5,
      computationHistory,
      logger
    );
  }
  getDemandDecoration(): MarketDecoration {
    return this.defaultStrategy.getDemandDecoration();
  }

  scoreProposal(proposal: Proposal): number {
    return this.defaultStrategy.scoreProposal(proposal);
  }
}

export class LeastExpensiveLinearPayuMarketStrategy implements MarketStrategy {
  constructor(
    private expectedTimeSecs = 60,
    private maxFixedPrice?: number,
    private maxPriceFor?: Map<Counter, number>,
    private logger?: Logger
  ) {}

  getDemandDecoration(): MarketDecoration {
    return {
      constraints: [`(${PRICE_MODEL}=${PriceModel.LINEAR})`],
      properties: [],
    };
  }

  scoreProposal(proposal: Proposal): number {
    const linear: ComLinear = new ComLinear().from_properties(proposal.properties);
    this.logger?.debug(`Scoring offer ${proposal.proposalId}, parameters: ${JSON.stringify(linear)}`);
    if (linear.scheme.value !== BillingScheme.PAYU) {
      this.logger?.debug(`Rejected offer ${proposal.proposalId}: unsupported scheme '${linear.scheme.value}'`);
      return SCORE_REJECTED;
    }

    const knownTimePrices = new Set([Counter.TIME, Counter.CPU]);

    for (const counter in linear.price_for) {
      if (!knownTimePrices.has(counter as Counter)) {
        this.logger?.debug(`Rejected offer ${proposal.proposalId}: unsupported counter '${counter}'`);
        return SCORE_REJECTED;
      }
    }

    if (this.maxFixedPrice !== undefined) {
      if (linear.fixed_price > this.maxFixedPrice) {
        this.logger?.debug(
          `Rejected offer ${proposal.proposalId}: fixed price higher than fixed price cap ${this.maxFixedPrice}.`
        );
        return SCORE_REJECTED;
      }
    }
    if (linear.fixed_price < 0) {
      this.logger?.debug(`Rejected offer ${proposal.proposalId}: negative fixed price`);
      return SCORE_REJECTED;
    }
    let expectedPrice = linear.fixed_price;

    for (const resource of knownTimePrices) {
      if (linear.price_for[resource] < 0) {
        this.logger?.debug(`Rejected offer ${proposal.proposalId}: negative price for '${resource}'`);
        return SCORE_REJECTED;
      }
      if (this.maxPriceFor) {
        const maxPrice = this.maxPriceFor.get(resource as Counter);
        if (maxPrice !== undefined && linear.price_for[resource] > maxPrice) {
          this.logger?.debug(
            `Rejected offer ${proposal.proposalId}: price for '${resource}' higher than price cap ${maxPrice}`
          );
          return SCORE_REJECTED;
        }
      }
      expectedPrice += linear.price_for[resource] * this.expectedTimeSecs;
    }
    // The higher the expected price value, the lower the score.
    // The score is always lower than SCORE_TRUSTED and is always higher than 0.
    return SCORE_TRUSTED / (expectedPrice + 1.01);
  }
}

/* A market strategy that modifies a base strategy based on history of agreements. */
export class DecreaseScoreForUnconfirmedAgreementMarketStrategy implements MarketStrategy {
  constructor(
    private baseStrategy: MarketStrategy,
    private factor: number,
    private computationHistory: ComputationHistory,
    private logger?: Logger
  ) {}

  getDemandDecoration(): MarketDecoration {
    return this.baseStrategy.getDemandDecoration();
  }

  /* Score `offer` using the base strategy and apply penalty if needed.
     If the offer issuer failed to approve the previous agreement (if any)
     then the base score is multiplied by `this._factor`. */
  scoreProposal(proposal: Proposal): number {
    let score = this.baseStrategy.scoreProposal(proposal);
    if (this.computationHistory.isProviderLastAgreementRejected(proposal.issuerId) && score > 0) {
      score *= this.factor;
      this.logger?.debug(`Decreasing score for offer ${proposal.proposalId} from '${proposal.issuerId}'`);
    }
    return score;
  }
}
