import { Allocation as Model, MarketDecoration } from "ya-ts-client/dist/ya-payment";
import { AllocationConfig, BasePaymentOptions } from "./config";
import { Allocation as AllocationModel } from "ya-ts-client/dist/ya-payment/src/models/allocation";
import { Events } from "../events";

export interface AllocationOptions extends BasePaymentOptions {
  account: { address: string; platform: string };
  expires?: number;
}

export class Allocation {
  public readonly id: string;
  public readonly timestamp: string;
  public readonly timeout?: string;
  public readonly address: string;
  public readonly paymentPlatform: string;
  public readonly totalAmount: string;
  private spentAmount: string;
  private remainingAmount: string;

  static async create(options: AllocationOptions): Promise<Allocation> {
    const config = new AllocationConfig(options);
    const now = new Date();
    const model: AllocationModel = {
      totalAmount: config.budget.toString(),
      paymentPlatform: config.account.platform,
      address: config.account.address,
      timestamp: now.toISOString(),
      timeout: new Date(+now + config.expires).toISOString(),
      makeDeposit: false,
      remainingAmount: "",
      spentAmount: "",
      allocationId: "",
    };
    const { data: newModel } = await config.api.createAllocation(model).catch((error) => {
      throw new Error(
        `Could not create new allocation. ${error.response?.data?.message || error.response?.data || error}`
      );
    });
    config.eventTarget?.dispatchEvent(new Events.AllocationCreated({ id: newModel.allocationId }));
    config.logger?.debug(
      `Allocation ${newModel.allocationId} has been created using payment platform ${config.account.platform}`
    );
    return new Allocation(config, newModel);
  }

  constructor(private options: AllocationConfig, model: Model) {
    this.id = model.allocationId;
    this.timeout = model.timeout;
    this.timestamp = model.timestamp;
    this.totalAmount = model.totalAmount;
    this.spentAmount = model.spentAmount;
    this.remainingAmount = model.remainingAmount;
    if (!model.address || !model.paymentPlatform) throw new Error("Account address and payment platform are required");
    this.address = model.address;
    this.paymentPlatform = model.paymentPlatform;
  }

  async getRemainingAmount(): Promise<string> {
    await this.refresh();
    return this.remainingAmount;
  }
  async getSpentAmount(): Promise<string> {
    await this.refresh();
    return this.spentAmount;
  }

  async release() {
    await this.options.api.releaseAllocation(this.id).catch((e) => {
      throw new Error(`Could not release allocation. ${e.response?.data || e}`);
    });
  }

  async getDemandDecoration(): Promise<MarketDecoration> {
    const { data: decoration } = await this.options.api.getDemandDecorations([this.id]).catch((e) => {
      throw new Error(`Unable to get demand decorations. ${e.response?.data?.message || e}`);
    });
    return decoration;
  }

  private async refresh() {
    const { data } = await this.options.api.getAllocation(this.id).catch((e) => {
      throw new Error(`Could not get allocation data. ${e.response?.data || e}`);
    });
    this.remainingAmount = data.remainingAmount;
    this.spentAmount = data.spentAmount;
  }
}
