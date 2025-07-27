import { PaymentApi } from "ya-ts-client";
import { ProviderInfo } from "../market/agreement";
export interface BaseModel {
    issuerId: string;
    recipientId: string;
    payeeAddr: string;
    payerAddr: string;
    paymentPlatform: string;
    agreementId: string;
    paymentDueDate?: string;
    status: PaymentApi.InvoiceDTO["status"];
}
/**
 * Common properties and methods for payment related documents - Invoices and DebitNotes
 */
export declare abstract class BaseDocument<ModelType extends BaseModel> {
    readonly id: string;
    protected model: ModelType;
    readonly provider: ProviderInfo;
    readonly recipientId: string;
    readonly payeeAddr: string;
    readonly requestorWalletAddress: string;
    readonly paymentPlatform: string;
    readonly agreementId: string;
    readonly paymentDueDate?: string;
    protected status: PaymentApi.InvoiceDTO["status"];
    protected constructor(id: string, model: ModelType, provider: ProviderInfo);
    /**
     * Tells what's the current status of the document
     */
    getStatus(): "ISSUED" | "RECEIVED" | "ACCEPTED" | "REJECTED" | "FAILED" | "SETTLED" | "CANCELLED";
}
