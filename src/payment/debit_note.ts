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
export class DebitNote extends BaseDocument<PaymentApi.DebitNoteDTO> {
  public readonly id: string;
  public readonly previousDebitNoteId?: string;
  public readonly timestamp: string;
  public readonly activityId: string;
  public readonly totalAmountDue: string;
  public readonly usageCounterVector?: object;

  /**
   *
   * @param model
   * @param providerInfo
   */
  public constructor(
    protected model: PaymentApi.DebitNoteDTO,
    providerInfo: ProviderInfo,
  ) {
    super(model.debitNoteId, model, providerInfo);
    this.id = model.debitNoteId;
    this.timestamp = model.timestamp;
    this.activityId = model.activityId;
    this.totalAmountDue = model.totalAmountDue;
    this.usageCounterVector = model.usageCounterVector;
  }

  public getPreciseAmount(): Decimal {
    return new Decimal(this.totalAmountDue);
  }
}
