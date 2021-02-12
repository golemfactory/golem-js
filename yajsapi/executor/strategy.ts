import { Activity } from "../props";
import { DemandBuilder } from "../props/builder";
import {
  BillingScheme,
  ComLinear,
  Counter,
  PriceModel,
  PRICE_MODEL,
} from "../props/com";
import { OfferProposal } from "../rest/market";
import { applyMixins, logger } from "../utils";

export const SCORE_NEUTRAL: number = 0.0;
export const SCORE_REJECTED: number = -1.0;
export const SCORE_TRUSTED: number = 100.0;

export const CFF_DEFAULT_PRICE_FOR_COUNTER: Map<Counter, number> = new Map([
  [Counter.TIME, parseFloat("0.002")],
  [Counter.CPU, parseFloat("0.002") * 10],
]);

export interface ComputationHistory {
  rejected_last_agreement: (string) => boolean;
}

export class MarketStrategy {
  /*Abstract market strategy*/

  async decorate_demand(demand: DemandBuilder): Promise<void> {}

  async score_offer(offer: OfferProposal, history?: ComputationHistory): Promise<Number> {
    return SCORE_REJECTED;
  }
}

interface MarketGeneral extends MarketStrategy, Object {}
class MarketGeneral {}

applyMixins(MarketGeneral, [MarketStrategy, Object]);

export class DummyMS extends MarketGeneral {
  max_for_counter: Map<Counter, Number> = CFF_DEFAULT_PRICE_FOR_COUNTER;
  max_fixed: Number = parseFloat("0.05");
  _activity?: Activity;

  async decorate_demand(demand: DemandBuilder): Promise<void> {
    demand.ensure(`(${PRICE_MODEL}=${PriceModel.LINEAR})`);
    this._activity = new Activity().from_properties(demand._properties);
  }

  async score_offer(offer: OfferProposal, history?: ComputationHistory): Promise<Number> {
    const linear: ComLinear = new ComLinear().from_properties(offer.props());

    if (linear.scheme.value !== BillingScheme.PAYU) {
      return SCORE_REJECTED;
    }

    if (linear.fixed_price > this.max_fixed) return SCORE_REJECTED;

    for (const [counter, price] of Object.entries(linear.price_for)) {
      if (!this.max_for_counter.has(counter as Counter)) return SCORE_REJECTED;
      if (price > <any>this.max_for_counter.get(counter as Counter))
        return SCORE_REJECTED;
    }

    return SCORE_NEUTRAL;
  }
}

export class LeastExpensiveLinearPayuMS {
  private _expected_time_secs: number;
  constructor(expected_time_secs: number = 60) {
    this._expected_time_secs = expected_time_secs;
  }

  async decorate_demand(demand: DemandBuilder): Promise<void> {
    demand.ensure(`(${PRICE_MODEL}=${PriceModel.LINEAR})`);
  }

  async score_offer(offer: OfferProposal, history?: ComputationHistory): Promise<Number> {
    const linear: ComLinear = new ComLinear().from_properties(offer.props());

    logger.debug(`Scoring offer ${offer.id()}, parameters: ${JSON.stringify(linear)}`);
    if (linear.scheme.value !== BillingScheme.PAYU) {
      logger.debug(`Rejected offer ${offer.id()}: unsupported scheme '${linear.scheme.value}'`);
      return SCORE_REJECTED;
    }

    const known_time_prices = new Set([Counter.TIME, Counter.CPU]);

    for (const counter in linear.price_for) {
      if (!(known_time_prices.has(counter as Counter))) {
        logger.debug(`Rejected offer ${offer.id()}: unsupported counter '${counter}'`);
        return SCORE_REJECTED;
      }
    }

    if (linear.fixed_price < 0) {
      logger.debug(`Rejected offer ${offer.id()}: negative fixed price`);
      return SCORE_REJECTED;
    }
    let expected_price = linear.fixed_price;

    for (const resource of known_time_prices) {
      if (linear.price_for[resource] < 0) {
        logger.debug(`Rejected offer ${offer.id()}: negative price for '${resource}'`);
        return SCORE_REJECTED;
      }
      expected_price += linear.price_for[resource] * this._expected_time_secs;
    }

    // The higher the expected price value, the lower the score.
    // The score is always lower than SCORE_TRUSTED and is always higher than 0.
    const score: number = (SCORE_TRUSTED * 1.0) / (expected_price + 1.01);
    return score;
  }
}

export class DecreaseScoreForUnconfirmedAgreement {
  /* A market strategy that modifies a base strategy based on history of agreements. */

  private _base_strategy;
  private _factor;

  constructor(base_strategy, factor) {
    this._base_strategy = base_strategy;
    this._factor = factor;
  }

  async decorate_demand(demand: DemandBuilder): Promise<void> {
    /* Decorate `demand` using the base strategy. */
    await this._base_strategy.decorate_demand(demand);
  }

  async score_offer(offer: OfferProposal, history?: ComputationHistory): Promise<Number> {
    /* Score `offer` using the base strategy and apply penalty if needed.
       If the offer issuer failed to approve the previous agreement (if any)
       then the base score is multiplied by `self._factor`. */
    let score = await this._base_strategy.score_offer(offer);
    if (history && history.rejected_last_agreement(offer.issuer()) && score > 0) {
      score *= this._factor;
      logger.debug(`Decreasing score for offer ${offer.id()} from '${offer.issuer()}'`);
    }
    return score;
  }
}
