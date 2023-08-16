import { Package } from "../package";
import { Allocation } from "../payment";
import { Demand, DemandOptions } from "./demand";
import { DemandConfig } from "./config";
import * as events from "../events/events";
import { DecorationsBuilder, MarketDecoration } from "./builder";
import { YagnaApi } from "../utils/yagna/yagna";

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
    const decorations = await this.getDecorations();
    const demandRequest = new DecorationsBuilder().addDecorations(decorations).getDemandRequest();
    const { data: id } = await this.yagnaApi.market.subscribeDemand(demandRequest).catch((e) => {
      const reason = e.response?.data?.message || e.toString();
      this.options.eventTarget?.dispatchEvent(new events.DemandFailed({ reason }));
      throw new Error(`Could not publish demand on the market. ${reason}`);
    });
    this.options.eventTarget?.dispatchEvent(
      new events.DemandSubscribed({
        id,
        details: new DecorationsBuilder().addDecorations(decorations).getDecorations(),
      }),
    );
    this.options.logger?.info(`Demand published on the market`);
    return new Demand(id, demandRequest, this.yagnaApi, this.options);
  }

  private async getDecorations(): Promise<MarketDecoration[]> {
    const taskDecorations = await this.taskPackage.getDemandDecoration();
    const allocationDecoration = await this.allocation.getDemandDecoration();
    const baseDecoration = this.getBaseDecorations();
    return [taskDecorations, allocationDecoration, baseDecoration];
  }

  private getBaseDecorations(): MarketDecoration {
    return new DecorationsBuilder()
      .addProperty("golem.srv.caps.multi-activity", true)
      .addProperty("golem.srv.comp.expiration", Date.now() + this.options.expiration)
      .addProperty("golem.node.debug.subnet", this.options.subnetTag)
      .addConstraint("golem.com.pricing.model", "linear")
      .addConstraint("golem.node.debug.subnet", this.options.subnetTag)
      .getDecorations();
  }
}
