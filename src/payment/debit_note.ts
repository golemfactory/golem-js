import { BasePaymentOptions, InvoiceConfig } from "./config";
import { DebitNote as Model } from "ya-ts-client/dist/ya-payment/src/models";
import { BaseNote } from "./invoice";
import { Events } from "../events";
import { Rejection } from "./rejection";
import { YagnaApi } from "../utils";
import { GolemError } from "../error/golem-error";

export type InvoiceOptions = BasePaymentOptions;

export interface DebitNoteDTO {
  id: string;
  timestamp: string;
  activityId: string;
  agreementId: string;
  totalAmountDue: number;
  usageCounterVector?: object;
}

/**
 * A Debit Note is an artifact issued by the Provider to the Requestor, in the context of a specific Activity. It is a notification of Total Amount Due incurred by the Activity until the moment the Debit Note is issued. This is expected to be used as trigger for payment in upfront-payment or pay-as-you-go scenarios. NOTE: Only Debit Notes with non-null paymentDueDate are expected to trigger payments. NOTE: Debit Notes flag the current Total Amount Due, which is accumulated from the start of Activity. Debit Notes are expected to trigger payments, therefore payment amount for the newly received Debit Note is expected to be determined by difference of Total Payments for the Agreement vs Total Amount Due.
 * @hidden
 */
export class DebitNote extends BaseNote<Model> {
  public readonly id: string;
  public readonly previousDebitNoteId?: string;
  public readonly timestamp: string;
  public readonly activityId: string;
  public readonly totalAmountDue: string;
  public readonly usageCounterVector?: object;

  /**
   * Create Debit Note Model
   *
   * @param debitNoteId - debit note id
   * @param yagnaApi - {@link YagnaApi}
   * @param options - {@link InvoiceOptions}
   */
  static async create(debitNoteId: string, yagnaApi: YagnaApi, options?: InvoiceOptions): Promise<DebitNote> {
    const config = new InvoiceConfig(options);
    const { data: model } = await yagnaApi.payment.getDebitNote(debitNoteId);
    return new DebitNote(model, yagnaApi, config);
  }

  /**
   *
   * @param model
   * @param yagnaApi
   * @param options
   * @protected
   * @hidden
   */
  protected constructor(
    model: Model,
    protected yagnaApi: YagnaApi,
    protected options: InvoiceConfig,
  ) {
    super(model, options);
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
      totalAmountDue: Number(this.totalAmountDue),
      usageCounterVector: this.usageCounterVector,
    };
  }

  /**
   * Accept Debit Note
   *
   * @param totalAmountAccepted
   * @param allocationId
   */
  async accept(totalAmountAccepted: string, allocationId: string) {
    try {
      await this.yagnaApi.payment.acceptDebitNote(this.id, { totalAmountAccepted, allocationId });
    } catch (e) {
      const reason = e?.response?.data?.message || e;
      this.options.eventTarget?.dispatchEvent(
        new Events.PaymentFailed({ id: this.id, agreementId: this.agreementId, reason }),
      );
      throw new GolemError(`Unable to accept debit note ${this.id} ${e?.response?.data?.message || e}`);
    }
    this.options.eventTarget?.dispatchEvent(new Events.DebitNoteAccepted({ ...this, amount: totalAmountAccepted }));
  }

  public async getStatus() {
    await this.refreshStatus();
    return this.status;
  }

  /**
   * Reject Debit Note
   *
   * @param rejection - {@link Rejection}
   */
  async reject(rejection: Rejection) {
    try {
      // TODO: not implemented by yagna - 501 returned
      // await this.yagnaApi.payment.rejectDebitNote(this.id, rejection);
    } catch (e) {
      throw new GolemError(`Unable to reject debit note ${this.id} ${e?.response?.data?.message || e}`);
    } finally {
      this.options.eventTarget?.dispatchEvent(
        new Events.PaymentFailed({ id: this.id, agreementId: this.agreementId, reason: rejection.message }),
      );
    }
  }

  protected async refreshStatus() {
    const { data: model } = await this.yagnaApi.payment.getDebitNote(this.id);
    this.status = model.status;
  }
}
