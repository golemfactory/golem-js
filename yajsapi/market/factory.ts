import { DemandOfferBase } from "ya-ts-client/dist/ya-market/src/models";
import { Activity as ActivityProp, NodeInfo as NodeProp, NodeInfoKeys } from "../props";
import { dayjs } from "../utils";
import { MarketDecoration } from "ya-ts-client/dist/ya-payment";
import { MarketProperty } from "ya-ts-client/dist/ya-payment/src/models";
import { Package } from "../package";
import { Allocation } from "../payment/allocation";
import { Demand, DemandOptions } from "./demand";
import { DemandConfig } from "./config";

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
    const { data: demandId } = await this.options.api.subscribeDemand(demandRequest).catch((e) => {
      throw new Error(`Could not publish demand on the market. ${e.response?.data || e}`);
    });
    return new Demand(demandId, this.properties, this.constraints, this.options);
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
    const activityProp = new ActivityProp();
    activityProp.expiration.value = dayjs().add(this.options.timeout, "ms");
    activityProp.multi_activity.value = true;
    const nodeProp = new NodeProp(this.options.subnetTag);
    return {
      properties: [...activityProp.properties(), ...nodeProp.properties()],
      constraints: [`(${NodeInfoKeys.subnet_tag}=${this.options.subnetTag})`],
    };
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
