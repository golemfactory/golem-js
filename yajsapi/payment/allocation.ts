import { RequestorApi, Allocation as Model } from "ya-ts-client/dist/ya-payment";

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
}
