import { Package } from "../package";
import { Allocation } from "../payment";
import { Demand, DemandOptions } from "./demand";
import { DemandConfig } from "./config";
import * as events from "../events/events";
import { DecorationsBuilder, MarketDecoration } from "./builder";
import { YagnaApi } from "../utils";
import { GolemMarketError, MarketErrorCode } from "./error";

/**
 * @internal
 */
export class DemandFactory {
  private options: DemandConfig;

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
      const { data: id } = await this.yagnaApi.market.subscribeDemand(demandRequest);
      this.options.eventTarget?.dispatchEvent(
        new events.DemandSubscribed({
          id,
          details: new DecorationsBuilder().addDecorations(decorations).getDecorations(),
        }),
      );
      this.options.logger.info(`Demand published on the market`);
      return new Demand(id, demandRequest, this.allocation, this.yagnaApi, this.options);
    } catch (error) {
      const reason = error.response?.data?.message || error.toString();
      this.options.eventTarget?.dispatchEvent(new events.DemandFailed({ reason }));
      throw new GolemMarketError(
        `Could not publish demand on the market. ${reason}`,
        MarketErrorCode.SubscriptionFailed,
        undefined,
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
