import { PaymentApi } from "ya-ts-client";
import { ProviderInfo } from "../market/agreement";
import { BaseDocument } from "./BaseDocument";
import Decimal from "decimal.js-light";
export interface IDebitNoteRepository {
    getById(id: string): Promise<DebitNote>;
}
/**
 * A Debit Note is an artifact issued by the Provider to the Requestor, in the context of a specific Activity. It is a notification of Total Amount Due incurred by the Activity until the moment the Debit Note is issued. This is expected to be used as trigger for payment in upfront-payment or pay-as-you-go scenarios. NOTE: Only Debit Notes with non-null paymentDueDate are expected to trigger payments. NOTE: Debit Notes flag the current Total Amount Due, which is accumulated from the start of Activity. Debit Notes are expected to trigger payments, therefore payment amount for the newly received Debit Note is expected to be determined by difference of Total Payments for the Agreement vs Total Amount Due.
 */
export declare class DebitNote extends BaseDocument<PaymentApi.DebitNoteDTO> {
    protected model: PaymentApi.DebitNoteDTO;
    readonly id: string;
    readonly previousDebitNoteId?: string;
    readonly timestamp: string;
    readonly activityId: string;
    readonly totalAmountDue: string;
    readonly usageCounterVector?: object;
    /**
     *
     * @param model
     * @param providerInfo
     */
    constructor(model: PaymentApi.DebitNoteDTO, providerInfo: ProviderInfo);
    getPreciseAmount(): Decimal;
}
