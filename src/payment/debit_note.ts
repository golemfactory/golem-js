import { PaymentApi } from "ya-ts-client";
import { ProviderInfo } from "../agreement";
import { EventEmitter } from "eventemitter3";
import { BaseDocument } from "./BaseDocument";

export interface DebitNoteEvents {
  accepted: (details: { id: string; agreementId: string; amount: string; provider: ProviderInfo }) => void;
  paymentFailed: (details: { id: string; agreementId: string; reason: string | undefined }) => void;
}

export interface DebitNoteDTO {
  id: string;
  timestamp: string;
  activityId: string;
  agreementId: string;
  totalAmountDue: string;
  usageCounterVector?: object;
}

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
  public readonly events = new EventEmitter<DebitNoteEvents>();

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

  get dto(): DebitNoteDTO {
    return {
      id: this.id,
      timestamp: this.timestamp,
      activityId: this.activityId,
      agreementId: this.agreementId,
      totalAmountDue: this.totalAmountDue,
      usageCounterVector: this.usageCounterVector,
    };
  }
}
