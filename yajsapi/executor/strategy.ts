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
import { applyMixins } from "../utils";

export const SCORE_NEUTRAL: number = 0.0;
export const SCORE_REJECTED: number = -1.0;
export const SCORE_TRUSTED: number = 100.0;

export const CFF_DEFAULT_PRICE_FOR_COUNTER: Map<Counter, number> = new Map([
  [Counter.TIME, parseFloat("0.002")],
  [Counter.CPU, parseFloat("0.002") * 10],
]);

export class MarketStrategy {
  /*Abstract market strategy*/

  async decorate_demand(demand: DemandBuilder): Promise<void> {}

  async score_offer(offer: OfferProposal): Promise<Number> {
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

  async score_offer(offer: OfferProposal): Promise<Number> {
    const linear: ComLinear = new ComLinear().from_properties(offer.props());

    if (linear.scheme.value != BillingScheme.PAYU) {
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

  async score_offer(offer: OfferProposal): Promise<Number> {
    const linear: ComLinear = new ComLinear().from_properties(offer.props());

    if (linear.scheme.value != BillingScheme.PAYU) return SCORE_REJECTED;

    const known_time_prices = [Counter.TIME, Counter.CPU];

    for (const counter in Object.keys(linear.price_for)) {
      if (!(counter in known_time_prices)) return SCORE_REJECTED;
    }

    if (linear.fixed_price < 0) return SCORE_REJECTED;
    let expected_price = linear.fixed_price;

    for (const resource in known_time_prices) {
      if (linear.price_for[resource] < 0) return SCORE_REJECTED;
      expected_price += linear.price_for[resource] * this._expected_time_secs;
    }

    // The higher the expected price value, the lower the score.
    // The score is always lower than SCORE_TRUSTED and is always higher than 0.
    const score: number = (SCORE_TRUSTED * 1.0) / (expected_price + 1.01);

    return score;
  }
}
