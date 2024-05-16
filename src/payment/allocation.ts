import { PaymentApi } from "ya-ts-client";
import { BasePaymentOptions } from "./config";
import { GolemConfigError } from "../shared/error/golem-error";

export interface AllocationOptions extends BasePaymentOptions {
  account: {
    address: string;
    platform: string;
  };
  expirationSec?: number;
}

/**
 * Represents a designated sum of money reserved for the purpose of making some particular payments. Allocations are currently purely virtual objects. An Allocation is connected to a payment account (wallet) specified by address and payment platform field.
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

  /** The amount that has been already spent */
  private spentAmount: string;

  /** The amount left for spending */
  private remainingAmount: string;

  constructor(private readonly model: PaymentApi.AllocationDTO) {
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
}
