import { DemandOfferBase } from "ya-ts-client/dist/ya-market/src/models";
import { MarketDecoration } from "ya-ts-client/dist/ya-payment";
import { MarketProperty } from "ya-ts-client/dist/ya-payment/src/models";
import { Package } from "../package";
import { Allocation } from "../payment";
import { Demand, DemandOptions } from "./demand";
import { DemandConfig } from "./config";
import * as events from "../events/events";
import { DecorationsBuilder } from "./builder";

export class DemandFactory {
  private properties: Array<MarketProperty> = [];
  private constraints: Array<string> = [];
  private options: DemandConfig;

  constructor(private taskPackage: Package, private allocations: Allocation[], options?: DemandOptions) {
    this.options = new DemandConfig(options);
  }

  async create(): Promise<Demand> {
    for (const decoration of await this.getDecorations()) {
      this.constraints.push(...decoration.constraints);
      this.properties.push(...decoration.properties);
    }
    const demandRequest = createDemandRequest(this.properties, this.constraints);
    const { data: id } = await this.options.api.subscribeDemand(demandRequest).catch((e) => {
      const reason = e.response?.data?.message || e.toString();
      this.options.eventTarget?.dispatchEvent(new events.SubscriptionFailed({ reason }));
      throw new Error(`Could not publish demand on the market. ${reason}`);
    });
    this.options.eventTarget?.dispatchEvent(new events.SubscriptionCreated({ id }));
    this.options.logger?.info(`Demand published on the market`);
    return new Demand(id, this.properties, this.constraints, this.options);
  }

  private async getDecorations(): Promise<MarketDecoration[]> {
    const taskDecorations = await this.taskPackage.getDemandDecoration();
    const allocationDecorations: MarketDecoration[] = [];
    for (const allocation of this.allocations) {
      allocationDecorations.push(await allocation.getDemandDecoration());
    }
    const baseDecoration = this.getBaseDecorations();
    return [taskDecorations, ...allocationDecorations, baseDecoration];
  }

  private getBaseDecorations(): MarketDecoration {
    return new DecorationsBuilder()
      .addProperty("golem.srv.caps.multi-activity", "true")
      .addProperty("golem.srv.comp.expiration", (Date.now() + this.options.timeout).toString())
      .addProperty("golem.node.debug.subnet", this.options.subnetTag)
      .addConstraint("golem.node.debug.subnet", this.options.subnetTag)
      .getDecorations();
  }
}

export const createDemandRequest = (props, cons): DemandOfferBase => {
  let constraints: string;
  if (!cons.length) constraints = "(&)";
  else if (cons.length == 1) constraints = cons[0];
  else constraints = `(&${cons.join("\n\t")})`;
  const properties = {};
  props.forEach((prop) => (properties[prop.key] = prop.value));
  return { constraints, properties };
};
