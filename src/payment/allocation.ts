import { PaymentApi } from "ya-ts-client";
import { AllocationConfig, BasePaymentOptions } from "./config";
import { YagnaApi } from "../utils";
import { GolemPaymentError, PaymentErrorCode } from "./error";
import { GolemConfigError, GolemInternalError } from "../error/golem-error";

/**
 * @hidden
 */
export interface AllocationOptions extends BasePaymentOptions {
  account: {
    address: string;
    platform: string;
  };
  expirationSec?: number;
  deposit?: {
    contract: string;
    id: string;
  };
}

/**
 * Allocation module - an object represents a designated sum of money reserved for the purpose of making some particular payments. Allocations are currently purely virtual objects. An Allocation is connected to a payment account (wallet) specified by address and payment platform field.
 * @hidden
 */
export class Allocation {
  /** Allocation ID */
  public readonly id: string;
  /** Timestamp of creation */
  public readonly timestamp: string;
  /** Timeout */
  public readonly timeout?: string;
  /** Address of requestor */
  public readonly address: string;
  /** Payment platform */
  public readonly paymentPlatform: string;
  /** Total allocation Amount */
  public readonly totalAmount: string;
  private spentAmount: string;
  private remainingAmount: string;

  /**
   * Create allocation
   */
  static async create(yagnaApi: YagnaApi, options: AllocationOptions): Promise<Allocation> {
    try {
      const config = new AllocationConfig(options);
      const now = new Date();
      const model: PaymentApi.AllocationDTO = {
        totalAmount: config.budget.toString(),
        paymentPlatform: config.account.platform,
        address: config.account.address,
        timestamp: now.toISOString(),
        timeout: new Date(+now + config.expirationSec * 1000).toISOString(),
        makeDeposit: false,
        remainingAmount: "",
        spentAmount: "",
        allocationId: "",
        deposit: config.deposit,
      };
      const newModel = await yagnaApi.payment.createAllocation(model);
      config.logger.debug(
        `Allocation ${newModel.allocationId} has been created for address ${config.account.address} using payment platform ${config.account.platform}`,
      );
      return new Allocation(yagnaApi, config, newModel);
    } catch (error) {
      throw new GolemPaymentError(
        `Could not create new allocation. ${error.response?.data?.message || error.response?.data || error}`,
        PaymentErrorCode.AllocationCreationFailed,
        undefined,
        undefined,
        error,
      );
    }
  }

  constructor(
    private readonly yagnaApi: YagnaApi,
    private readonly options: AllocationConfig,
    model: PaymentApi.AllocationDTO,
  ) {
    this.id = model.allocationId;
    this.timeout = model.timeout;
    this.timestamp = model.timestamp;
    this.totalAmount = model.totalAmount;
    this.spentAmount = model.spentAmount;
    this.remainingAmount = model.remainingAmount;
    if (!model.address || !model.paymentPlatform) {
      throw new GolemConfigError("Account address and payment platform are required");
    }
    this.address = model.address;
    this.paymentPlatform = model.paymentPlatform;
  }

  /**
   * Returns remaining amount for allocation
   *
   * @return amount remaining
   */
  async getRemainingAmount(): Promise<string> {
    await this.refresh();
    return this.remainingAmount;
  }

  /**
   * Returns already spent amount for allocation
   *
   * @return spent amount
   */
  async getSpentAmount(): Promise<string> {
    await this.refresh();
    return this.spentAmount;
  }

  /**
   * Release allocation
   */
  async release() {
    try {
      await this.yagnaApi.payment.releaseAllocation(this.id);
      this.options.logger.debug(`Allocation ${this.id} has been released.`);
    } catch (error) {
      throw new GolemPaymentError(
        `Could not release allocation. ${error.response?.data?.message || error}`,
        PaymentErrorCode.AllocationReleaseFailed,
        this,
        undefined,
        error,
      );
    }
  }

  /**
   * Uses the helper API of yagna to provide demand decorations (properties and constraints) based on the allocation that's going to be used
   *
   * @return {@link MarketDecoration}
   */
  async getDemandDecoration(): Promise<PaymentApi.MarketDecorationDTO> {
    try {
      const decoration = await this.yagnaApi.payment.getDemandDecorations([this.id]);
      return decoration;
    } catch (error) {
      throw new GolemInternalError(
        `Unable to get demand decorations. ${error.response?.data?.message || error}`,
        error,
      );
    }
  }

  private async refresh() {
    try {
      const data = await this.yagnaApi.payment.getAllocation(this.id);
      this.remainingAmount = data.remainingAmount;
      this.spentAmount = data.spentAmount;
    } catch (error) {
      throw new GolemInternalError(`Could not get allocation data. ${error.response?.data || error}`, error);
    }
  }
}
