import { RequestorApi, Allocation as Model, MarketDecoration } from "ya-ts-client/dist/ya-payment";
import { MarketOptions } from "../market/market_service";

export class Allocation {
  public readonly allocationId: string = "";
  public readonly address?: string = "";
  public readonly paymentPlatform?: string = "";
  public readonly totalAmount: string = "";
  public readonly spentAmount: string = "";
  public readonly remainingAmount: string = "";
  public readonly timestamp: string = "";
  public readonly timeout?: string;
  public readonly makeDeposit: boolean = false;
  constructor(private api: RequestorApi, private model: Model) {
    Object.keys(model).forEach((key) => (this[key] = model[key]));
  }

  async releaseAllocation() {
    await this.api.releaseAllocation(this.allocationId);
  }

  async getDemandDecoration(): Promise<MarketDecoration> {
    const { data: decorations } = await this.api.getDemandDecorations([this.allocationId]).catch((e) => {
      throw new Error(`Could not get demand decorations. ${e.response?.data || e}`);
    });
    return decorations;
  }

  // TODO
  static async create(): Promise<Allocation> {
    return {} as Allocation;
  }
}
