import { BasePaymentOptions, InvoiceConfig } from "./config";
import { DebitNote as Model, Rejection } from "ya-ts-client/dist/ya-payment/src/models";
import { BaseNote } from "./invoice";
import { Events } from "../events";

export type InvoiceOptions = BasePaymentOptions;

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
   * @param options - {@link InvoiceOptions}
   */
  static async create(debitNoteId: string, options?: InvoiceOptions): Promise<DebitNote> {
    const config = new InvoiceConfig(options);
    const { data: model } = await config.api.getDebitNote(debitNoteId);
    return new DebitNote(model, config);
  }

  protected constructor(model: Model, protected options: InvoiceConfig) {
    super(model, options);
    this.id = model.debitNoteId;
    this.timestamp = model.timestamp;
    this.activityId = model.activityId;
    this.totalAmountDue = model.totalAmountDue;
    this.usageCounterVector = model.usageCounterVector;
  }

  /**
   * Accept Debit Note
   *
   * @param totalAmountAccepted
   * @param allocationId
   */
  async accept(totalAmountAccepted: string, allocationId: string) {
    try {
      await this.options.api.acceptDebitNote(this.id, { totalAmountAccepted, allocationId });
    } catch (e) {
      const reason = e?.response?.data?.message || e;
      this.options.eventTarget?.dispatchEvent(
        new Events.PaymentFailed({ id: this.id, agreementId: this.agreementId, reason })
      );
      throw new Error(`Unable to accept debit note ${this.id} ${e?.response?.data?.message || e}`);
    }
  }

  /**
   * Reject Debit Note
   *
   * @param rejection - ya-ts-client Rejection
   */
  // TODO:  change this to yajsapi Rejection type
  async reject(rejection: Rejection) {
    try {
      await this.options.api.rejectDebitNote(this.id, rejection);
    } catch (e) {
      throw new Error(`Unable to reject debit note ${this.id} ${e?.response?.data?.message || e}`);
    } finally {
      this.options.eventTarget?.dispatchEvent(
        new Events.PaymentFailed({ id: this.id, agreementId: this.agreementId, reason: rejection.message })
      );
    }
  }

  protected async refreshStatus() {
    const { data: model } = await this.options.api.getDebitNote(this.id);
    this.status = model.status;
  }
}
