import { PaymentApi } from "ya-ts-client";
import { BasePaymentOptions } from "./config";
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
export declare class Allocation {
    private readonly model;
    /** Allocation ID */
    readonly id: string;
    /** Timestamp of creation */
    readonly timestamp: string;
    /** Timeout */
    readonly timeout?: string;
    /** Address of requestor */
    readonly address: string;
    /** Payment platform */
    readonly paymentPlatform: string;
    /** Total allocation Amount */
    readonly totalAmount: string;
    /** The amount that has been already spent */
    readonly spentAmount: string;
    /** The amount left for spending */
    readonly remainingAmount: string;
    constructor(model: PaymentApi.AllocationDTO);
}
