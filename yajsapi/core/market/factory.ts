import { DemandOfferBase } from "ya-ts-client/dist/ya-market/src/models";
import { Activity as ActivityProp, NodeInfo as NodeProp, NodeInfoKeys } from "../../props";
import { dayjs } from "../../utils";
import { MarketDecoration } from "ya-ts-client/dist/ya-payment";
import { MarketProperty } from "ya-ts-client/dist/ya-payment/src/models";
import { Package } from "../../package";
import { Allocation } from "../../payment/allocation";
import { Demand, DemandOptions } from "./demand";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { Configuration } from "ya-ts-client/dist/ya-market";
import { YagnaOptions } from "../../executor";

const DEFAULT_TIMEOUT = 30000;

export class DemandFactory {
  private properties: Array<MarketProperty> = [];
  private constraints: Array<string> = [];
  private subnetTag: string;
  private timeout: number;
  private yagnaOptions?: YagnaOptions;

  constructor(
    private taskPackage: Package,
    private allocations: Allocation[],
    { subnetTag, timeout, yagnaOptions }: DemandOptions
  ) {
    this.timeout = timeout || DEFAULT_TIMEOUT;
    this.subnetTag = subnetTag;
    this.yagnaOptions = yagnaOptions;
  }

  async create(): Promise<Demand> {
    const api = new RequestorApi(
      new Configuration({
        apiKey: this.yagnaOptions?.apiKey || process.env.YAGNA_APPKEY,
        basePath: (this.yagnaOptions?.basePath || process.env.YAGNA_URL) + "/market-api/v1",
        accessToken: this.yagnaOptions?.apiKey || process.env.YAGNA_APPKEY,
      })
    );
    for (const decoration of await this.getDecorations()) {
      this.constraints.push(...decoration.constraints);
      this.properties.push(...decoration.properties);
    }
    const demandRequest = createDemandRequest(this.properties, this.constraints);
    const { data: demandId } = await api.subscribeDemand(demandRequest).catch((e) => {
      throw new Error(`Could not publish demand on the market. ${e.response?.data || e}`);
    });
    return new Demand(demandId, api, this.properties, this.constraints, this.getAllowedPaymentsPlatforms());
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
    activityProp.expiration.value = dayjs().add(this.timeout, "ms");
    activityProp.multi_activity.value = true;
    const nodeProp = new NodeProp(this.subnetTag);
    return {
      properties: [...activityProp.properties(), ...nodeProp.properties()],
      constraints: [`(${NodeInfoKeys.subnet_tag}=${this.subnetTag})`],
    };
  }

  private getAllowedPaymentsPlatforms(): string[] {
    const paymentPlatforms: string[] = [];
    this.allocations.forEach((a) => {
      if (a.paymentPlatform) paymentPlatforms.push(a.paymentPlatform);
    });
    return paymentPlatforms;
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
