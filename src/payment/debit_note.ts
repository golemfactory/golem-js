import { BasePaymentOptions, InvoiceConfig } from "./config";
import { PaymentApi } from "ya-ts-client";
import { BaseNote } from "./invoice";
import { Rejection } from "./rejection";
import { YagnaApi } from "../shared/utils";
import { GolemPaymentError, PaymentErrorCode } from "./error";
import { ProviderInfo } from "../agreement";
import { ProposalProperties } from "../market/proposal";
import { EventEmitter } from "eventemitter3";

export interface DebitNoteEvents {
  accepted: (details: { id: string; agreementId: string; amount: string; provider: ProviderInfo }) => void;
  paymentFailed: (details: { id: string; agreementId: string; reason: string | undefined }) => void;
}

export type InvoiceOptions = BasePaymentOptions;

export interface DebitNoteDTO {
  id: string;
  timestamp: string;
  activityId: string;
  agreementId: string;
  totalAmountDue: string;
  usageCounterVector?: object;
}

/**
 * A Debit Note is an artifact issued by the Provider to the Requestor, in the context of a specific Activity. It is a notification of Total Amount Due incurred by the Activity until the moment the Debit Note is issued. This is expected to be used as trigger for payment in upfront-payment or pay-as-you-go scenarios. NOTE: Only Debit Notes with non-null paymentDueDate are expected to trigger payments. NOTE: Debit Notes flag the current Total Amount Due, which is accumulated from the start of Activity. Debit Notes are expected to trigger payments, therefore payment amount for the newly received Debit Note is expected to be determined by difference of Total Payments for the Agreement vs Total Amount Due.
 * @hidden
 */
export class DebitNote extends BaseNote<PaymentApi.DebitNoteDTO> {
  public readonly id: string;
  public readonly previousDebitNoteId?: string;
  public readonly timestamp: string;
  public readonly activityId: string;
  public readonly totalAmountDue: string;
  public readonly usageCounterVector?: object;
  public readonly events = new EventEmitter<DebitNoteEvents>();

  /**
   * Create Debit Note Model
   *
   * @param debitNoteId - debit note id
   * @param yagnaApi - {@link YagnaApi}
   * @param options - {@link InvoiceOptions}
   */
  static async create(debitNoteId: string, yagnaApi: YagnaApi, options?: InvoiceOptions): Promise<DebitNote> {
    const config = new InvoiceConfig(options);
    const model = await yagnaApi.payment.getDebitNote(debitNoteId);
    const agreement = await yagnaApi.market.getAgreement(model.agreementId);
    const providerInfo = {
      id: model.issuerId,
      walletAddress: model.payeeAddr,
      name: (agreement.offer.properties as ProposalProperties)["golem.node.id.name"],
    };
    return new DebitNote(model, providerInfo, yagnaApi, config);
  }

  /**
   *
   * @param model
   * @param providerInfo
   * @param yagnaApi
   * @param options
   * @protected
   * @hidden
   */
  protected constructor(
    protected model: PaymentApi.DebitNoteDTO,
    providerInfo: ProviderInfo,
    protected yagnaApi: YagnaApi,
    protected options: InvoiceConfig,
  ) {
    super(model, providerInfo, options);
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

  /**
   * Accept Debit Note
   *
   * @param totalAmountAccepted
   * @param allocationId
   */
  async accept(totalAmountAccepted: string, allocationId: string) {
    try {
      await this.yagnaApi.payment.acceptDebitNote(this.id, {
        totalAmountAccepted,
        allocationId,
      });
    } catch (error) {
      const reason = error?.response?.data?.message || error;
      this.events.emit("paymentFailed", { id: this.id, agreementId: this.agreementId, reason });
      throw new GolemPaymentError(
        `Unable to accept debit note ${this.id}. ${reason}`,
        PaymentErrorCode.DebitNoteAcceptanceFailed,
        undefined,
        this.provider,
        error,
      );
    }
    this.events.emit("accepted", {
      id: this.id,
      agreementId: this.agreementId,
      amount: totalAmountAccepted,
      provider: this.provider,
    });
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
    } catch (error) {
      throw new GolemPaymentError(
        `Unable to reject debit note ${this.id}. ${error?.response?.data?.message || error}`,
        PaymentErrorCode.DebitNoteRejectionFailed,
        undefined,
        this.provider,
        error,
      );
    } finally {
      this.events.emit("paymentFailed", { id: this.id, agreementId: this.agreementId, reason: rejection.message });
    }
  }

  protected async refreshStatus() {
    this.model = await this.yagnaApi.payment.getDebitNote(this.id);
  }
}
