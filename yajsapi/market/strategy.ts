import { Proposal } from "./index.js";
import { MarketDecoration } from "ya-ts-client/dist/ya-payment/src/models/index.js";
import { Logger } from "../utils/index.js";
import { AgreementCandidate } from "../agreement/service.js";

export const SCORE_NEUTRAL = 0.0;
export const SCORE_REJECTED = -1.0;
export const SCORE_TRUSTED = 100.0;

enum Counter {
  TIME = "golem.usage.duration_sec",
  CPU = "golem.usage.cpu_sec",
  STORAGE = "golem.usage.storage_gib",
  MAXMEM = "golem.usage.gib",
  UNKNOWN = "",
}

export interface ComputationHistory {
  //isProviderLastAgreementRejected: (providerId: string) => boolean;
}

export interface MarketStrategy {
  checkProposal(proposal: Proposal): Promise<boolean>;
  getBestAgreementCandidate(candidates: AgreementCandidate[]): Promise<AgreementCandidate>;
}

export class DummyMarketStrategy implements MarketStrategy {
  constructor(readonly logger?: Logger) {}
  async checkProposal(proposal: Proposal): Promise<boolean> {
    return Promise.resolve(true);
  }

  async getBestAgreementCandidate(candidates: AgreementCandidate[]): Promise<AgreementCandidate> {
    return candidates[0];
  }
}

// export class DefaultMarketStrategy implements MarketStrategy {
//   private defaultStrategy: MarketStrategy;
//   constructor(computationHistory: ComputationHistory, logger?: Logger) {
//     this.defaultStrategy = new DecreaseScoreForUnconfirmedAgreementMarketStrategy(
//       new LeastExpensiveLinearPayuMarketStrategy(
//         60,
//         1.0,
//         new Map([
//           [Counter.TIME, 0.1],
//           [Counter.CPU, 0.2],
//         ]),
//         logger
//       ),
//       0.5,
//       computationHistory,
//       logger
//     );
//   }
//   getDemandDecoration(): MarketDecoration {
//     return this.defaultStrategy.getDemandDecoration();
//   }
//
//   scoreProposal(proposal: Proposal): number {
//     return this.defaultStrategy.scoreProposal(proposal);
//   }
// }

// export class LeastExpensiveLinearPayuMarketStrategy implements MarketStrategy {
//   constructor(
//     private expectedTimeSecs = 60,
//     private maxFixedPrice?: number,
//     private maxPriceFor?: Map<Counter, number>,
//     private logger?: Logger
//   ) {}
//
//   getDemandDecoration(): MarketDecoration {
//     return {
//       constraints: [`(golem.com.pricing.model=linear)`],
//       properties: [],
//     };
//   }
//
//   scoreProposal(proposal: Proposal): number {
//     if (proposal.properties["golem.com.scheme"] !== "payu") {
//       this.logger?.debug(
//         `Rejected offer ${proposal.id}: unsupported scheme '${proposal.properties["golem.com.scheme"]}'`
//       );
//       return SCORE_REJECTED;
//     }
//
//     const knownTimePrices = new Set([Counter.TIME, Counter.CPU]);
//
//     const coeffs = proposal.properties["golem.com.pricing.model.linear.coeffs"] || [];
//     const usages = proposal.properties["golem.com.usage.vector"] || [];
//
//     const fixedPrice = parseFloat(coeffs.pop() || "0");
//     let priceFor: object = {};
//     for (let i = 0; i < coeffs.length; i++) {
//       priceFor = { ...priceFor, [usages[i]]: parseFloat(coeffs[i]) };
//     }
//
//     for (const counter in priceFor) {
//       if (!knownTimePrices.has(counter as Counter)) {
//         this.logger?.debug(`Rejected offer ${proposal.id}: unsupported counter '${counter}'`);
//         return SCORE_REJECTED;
//       }
//     }
//
//     if (this.maxFixedPrice !== undefined) {
//       if (fixedPrice > this.maxFixedPrice) {
//         this.logger?.debug(
//           `Rejected offer ${proposal.id}: fixed price higher than fixed price cap ${this.maxFixedPrice}.`
//         );
//         return SCORE_REJECTED;
//       }
//     }
//     if (fixedPrice < 0) {
//       this.logger?.debug(`Rejected offer ${proposal.id}: negative fixed price`);
//       return SCORE_REJECTED;
//     }
//     let expectedPrice = fixedPrice;
//
//     for (const resource of knownTimePrices) {
//       if (priceFor[resource] < 0) {
//         this.logger?.debug(`Rejected offer ${proposal.id}: negative price for '${resource}'`);
//         return SCORE_REJECTED;
//       }
//       if (this.maxPriceFor) {
//         const maxPrice = this.maxPriceFor.get(resource as Counter);
//         if (maxPrice !== undefined && priceFor[resource] > maxPrice) {
//           this.logger?.debug(
//             `Rejected offer ${proposal.id}: price for '${resource}' higher than price cap ${maxPrice}`
//           );
//           return SCORE_REJECTED;
//         }
//       }
//       expectedPrice += priceFor[resource] * this.expectedTimeSecs;
//     }
//     // The higher the expected price value, the lower the score.
//     // The score is always lower than SCORE_TRUSTED and is always higher than 0.
//     return SCORE_TRUSTED / (expectedPrice + 1.01);
//   }
// }
//
// /* A market strategy that modifies a base strategy based on history of agreements. */
// export class DecreaseScoreForUnconfirmedAgreementMarketStrategy implements MarketStrategy {
//   constructor(
//     private baseStrategy: MarketStrategy,
//     private factor: number,
//     private computationHistory: ComputationHistory,
//     private logger?: Logger
//   ) {}
//
//   getDemandDecoration(): MarketDecoration {
//     return this.baseStrategy.getDemandDecoration();
//   }
//
//   /* Score `offer` using the base strategy and apply penalty if needed.
//      If the offer issuer failed to approve the previous agreement (if any)
//      then the base score is multiplied by `this._factor`. */
//   scoreProposal(proposal: Proposal): number {
//     let score = this.baseStrategy.scoreProposal(proposal);
//     if (this.computationHistory.isProviderLastAgreementRejected(proposal.issuerId) && score > 0) {
//       score *= this.factor;
//       this.logger?.debug(`Decreasing score for offer ${proposal.id} from '${proposal.issuerId}'`);
//     }
//     return score;
//   }
// }
