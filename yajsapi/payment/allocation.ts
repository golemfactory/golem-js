import { RequestorApi, Allocation as Model, MarketDecoration } from "ya-ts-client/dist/ya-payment";
import { MarketOptions } from "../market/service";
import { YagnaOptions } from "../executor";
import { AllocationConfig } from "./config";
import { dayjs, Logger } from "../utils";
import { DEFAULT_INVOICE_RECEIVE_TIMEOUT } from "../executor/defaults";
import { Allocation as AllocationModel } from "ya-ts-client/dist/ya-payment/src/models/allocation";

export interface AllocationOptions {
  account: { address: string; platform: string };
  yagnaOptions?: YagnaOptions;
  budget?: number;
  payment?: { driver?: string; network?: string };
  timeout?: number;
  expires?: number;
  invoiceReceiveTimeout?: number;
  logger?: Logger;
}

export class Allocation {
  public readonly id: string;
  public readonly address: string;
  public readonly paymentPlatform: string;
  public readonly totalAmount: string;
  public readonly spentAmount: string;
  public readonly remainingAmount: string;
  public readonly timestamp: string;
  public readonly timeout: string;
  public readonly makeDeposit: boolean;

  static async create(options: AllocationOptions): Promise<Allocation> {
    const config = new AllocationConfig(options);
    const now = new Date();
    const model: AllocationModel = {
      totalAmount: config.budget.toString(),
      paymentPlatform: config.payment.driver,
      address: config.account.address,
      timestamp: now.toISOString(),
      timeout: new Date(config.expires).toISOString(),
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
    config.logger?.debug(
      `Allocation ${newModel.allocationId} has been created using payment platform ${config.account.platform}`
    );
    return new Allocation(config, newModel);
  }

  constructor(private options: AllocationConfig, model: Model) {
    Object.keys(model).forEach((key) => (this[key] = model[key]));
  }

  async release() {
    await this.options.api.releaseAllocation(this.allocationId);
  }

  async getDemandDecoration(): Promise<MarketDecoration> {
    const { data: decorations } = await this.options.api.getDemandDecorations([this.allocationId]).catch((e) => {
      throw new Error(`Could not get demand decorations. ${e.response?.data || e}`);
    });
    return decorations;
  }
}
