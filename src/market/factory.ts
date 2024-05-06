import { Package } from "./package";
import { Allocation } from "../payment";
import { Demand, DemandOptions } from "./demand";
import { DemandConfig } from "./config";
import { DecorationsBuilder, MarketDecoration } from "./builder";
import { YagnaApi } from "../shared/utils";
import { GolemMarketError, MarketErrorCode } from "./error";
import { EventEmitter } from "eventemitter3";

export interface DemandFactoryEvents {
  demandSubscribed: (details: { id: string; details: MarketDecoration }) => void;
  demandFailed: (details: { reason: string }) => void;
}

/**
 * @internal
 */
export class DemandFactory {
  private options: DemandConfig;
  public readonly events = new EventEmitter<DemandFactoryEvents>();

  constructor(
    private readonly taskPackage: Package,
    private readonly allocation: Allocation,
    private readonly yagnaApi: YagnaApi,
    options?: DemandOptions,
  ) {
    this.options = new DemandConfig(options);
  }

  async create(): Promise<Demand> {
    try {
      const decorations = await this.getDecorations();
      const demandRequest = new DecorationsBuilder().addDecorations(decorations).getDemandRequest();
      const id = await this.yagnaApi.market.subscribeDemand(demandRequest);
      if (typeof id !== "string") {
        throw new GolemMarketError(
          `Invalid demand ID received from the market: ${id}`,
          MarketErrorCode.SubscriptionFailed,
        );
      }
      this.events.emit("demandSubscribed", {
        id,
        details: new DecorationsBuilder().addDecorations(decorations).getDecorations(),
      });
      this.options.logger.info(`Demand published on the market`);
      return new Demand(id, demandRequest, this.allocation, this.yagnaApi, this.options);
    } catch (error) {
      const reason = error.response?.data?.message || error.toString();
      this.events.emit("demandFailed", { reason });
      throw new GolemMarketError(
        `Could not publish demand on the market. ${reason}`,
        MarketErrorCode.SubscriptionFailed,
        error,
      );
    }
  }

  private async getDecorations(): Promise<MarketDecoration[]> {
    const taskDecorations = await this.taskPackage.getDemandDecoration();
    const allocationDecoration = await this.allocation.getDemandDecoration();
    const baseDecoration = this.getBaseDecorations();
    return [taskDecorations, allocationDecoration, baseDecoration];
  }

  private getBaseDecorations(): MarketDecoration {
    const builder = new DecorationsBuilder();

    // Configure basic properties
    builder
      .addProperty("golem.srv.caps.multi-activity", true)
      .addProperty("golem.srv.comp.expiration", Date.now() + this.options.expirationSec * 1000)
      .addProperty("golem.node.debug.subnet", this.options.subnetTag)
      .addProperty("golem.com.payment.debit-notes.accept-timeout?", this.options.debitNotesAcceptanceTimeoutSec)
      .addConstraint("golem.com.pricing.model", "linear")
      .addConstraint("golem.node.debug.subnet", this.options.subnetTag);

    // Configure mid-agreement payments
    builder
      .addProperty("golem.com.scheme.payu.debit-note.interval-sec?", this.options.midAgreementDebitNoteIntervalSec)
      .addProperty("golem.com.scheme.payu.payment-timeout-sec?", this.options.midAgreementPaymentTimeoutSec);

    return builder.getDecorations();
  }
}
