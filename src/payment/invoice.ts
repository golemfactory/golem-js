import { BasePaymentOptions, InvoiceConfig } from "./config";
import { PaymentApi } from "ya-ts-client";
import { Events } from "../events";
import { Rejection } from "./rejection";
import { YagnaApi } from "../utils";
import { GolemPaymentError, PaymentErrorCode } from "./error";
import { ProviderInfo } from "../agreement";
import { ProposalProperties } from "../market/proposal";

export type InvoiceOptions = BasePaymentOptions;

export interface InvoiceDTO {
  id: string;
  timestamp: string;
  activityIds?: string[];
  agreementId: string;
  paymentDueDate?: string;
  status: string;
  requestorWalletAddress: string;
  provider: ProviderInfo;
  paymentPlatform: string;
  amount: number;
}

/**
 * @hidden
 */
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
 * @hidden
 */
export abstract class BaseNote<ModelType extends BaseModel> {
  public abstract readonly id: string;
  public readonly recipientId: string;
  public readonly payeeAddr: string;
  public readonly requestorWalletAddress: string;
  public readonly paymentPlatform: string;
  public readonly agreementId: string;
  public readonly paymentDueDate?: string;
  protected status: PaymentApi.InvoiceDTO["status"];

  protected constructor(
    protected model: ModelType,
    public readonly provider: ProviderInfo,
    protected options: InvoiceConfig,
  ) {
    this.recipientId = model.recipientId;
    this.payeeAddr = model.payeeAddr;
    this.requestorWalletAddress = model.payerAddr;
    this.paymentPlatform = model.paymentPlatform;
    this.agreementId = model.agreementId;
    this.paymentDueDate = model.paymentDueDate;
    this.status = model.status;
  }
  protected async getStatus(): Promise<PaymentApi.InvoiceDTO["status"]> {
    try {
      await this.refreshStatus();
      return this.model.status;
    } catch (error) {
      throw new GolemPaymentError(
        `Unable to query payment status. ${error?.data?.message || error.toString()}`,
        PaymentErrorCode.PaymentStatusQueryFailed,
        undefined,
        this.provider,
        error,
      );
    }
  }
  protected abstract accept(totalAmountAccepted: number, allocationId: string): Promise<void>;
  protected abstract reject(rejection: Rejection): Promise<void>;
  protected abstract refreshStatus(): Promise<void>;
}

/**
 * An Invoice is an artifact issued by the Provider to the Requestor, in the context of a specific Agreement. It indicates the total Amount owed by the Requestor in this Agreement. No further Debit Notes shall be issued after the Invoice is issued. The issue of Invoice signals the Termination of the Agreement (if it hasn't been terminated already). No Activity execution is allowed after the Invoice is issued.
 * @hidden
 */
export class Invoice extends BaseNote<PaymentApi.InvoiceDTO> {
  /** Invoice ID */
  public readonly id: string;
  /** Activities IDs covered by this Invoice */
  public readonly activityIds?: string[];
  /** Amount in the invoice */
  public readonly amount: number;
  /** Invoice creation timestamp */
  public readonly timestamp: string;
  /** Recipient ID */
  public readonly recipientId: string;

  /**
   * Create invoice using invoice ID
   *
   * @param invoiceId - Invoice ID
   * @param yagnaApi - {@link YagnaApi}
   * @param options - {@link InvoiceOptions}
   */
  static async create(invoiceId: string, yagnaApi: YagnaApi, options?: InvoiceOptions): Promise<Invoice> {
    const config = new InvoiceConfig(options);
    const model = await yagnaApi.payment.getInvoice(invoiceId);
    const agreement = await yagnaApi.market.getAgreement(model.agreementId);
    const providerInfo = {
      id: model.issuerId,
      walletAddress: model.payeeAddr,
      name: (agreement.offer.properties as ProposalProperties)["golem.node.id.name"],
    };
    return new Invoice(model, providerInfo, yagnaApi, config);
  }

  /**
   * @param model
   * @param providerInfo
   * @param yagnaApi
   * @param options
   * @protected
   * @hidden
   */
  protected constructor(
    protected model: PaymentApi.InvoiceDTO,
    providerInfo: ProviderInfo,
    protected yagnaApi: YagnaApi,
    protected options: InvoiceConfig,
  ) {
    super(model, providerInfo, options);
    this.id = model.invoiceId;
    this.activityIds = model.activityIds;
    this.amount = Number(model.amount);
    this.timestamp = model.timestamp;
    this.recipientId = model.recipientId;
  }

  get dto(): InvoiceDTO {
    return {
      id: this.id,
      timestamp: this.timestamp,
      activityIds: this.activityIds,
      agreementId: this.agreementId,
      paymentDueDate: this.paymentDueDate,
      status: this.status,
      requestorWalletAddress: this.requestorWalletAddress,
      provider: this.provider,
      paymentPlatform: this.paymentPlatform,
      amount: this.amount,
    };
  }

  /**
   * Get Invoice Status
   *
   * @return {@link InvoiceStatus}
   */
  async getStatus(): Promise<PaymentApi.InvoiceDTO["status"]> {
    await this.refreshStatus();
    return this.status;
  }

  /**
   * Accept Invoice
   *
   * @param totalAmountAccepted
   * @param allocationId
   */
  async accept(totalAmountAccepted: number, allocationId: string) {
    try {
      await this.yagnaApi.payment.acceptInvoice(this.id, {
        totalAmountAccepted: `${totalAmountAccepted}`,
        allocationId,
      });
    } catch (error) {
      const reason = error?.response?.data?.message || error;
      this.options.eventTarget?.dispatchEvent(
        new Events.PaymentFailed({ id: this.id, agreementId: this.agreementId, reason }),
      );
      throw new GolemPaymentError(
        `Unable to accept invoice ${this.id} ${reason}`,
        PaymentErrorCode.InvoiceAcceptanceFailed,
        undefined,
        this.provider,
        error,
      );
    }
    this.options.eventTarget?.dispatchEvent(
      new Events.PaymentAccepted({
        id: this.id,
        agreementId: this.agreementId,
        amount: this.amount,
        provider: this.provider,
      }),
    );
  }

  /**
   * Reject Invoice
   *
   * @param rejection - {@link Rejection}
   */
  async reject(rejection: Rejection) {
    try {
      // TODO: not implemented by yagna !!!!
      // await this.yagnaApi.payment.rejectInvoice(this.id, rejection);
    } catch (error) {
      throw new GolemPaymentError(
        `Unable to reject invoice ${this.id} ${error?.response?.data?.message || error}`,
        PaymentErrorCode.InvoiceRejectionFailed,
        undefined,
        this.provider,
        error,
      );
    } finally {
      this.options.eventTarget?.dispatchEvent(
        new Events.PaymentFailed({ id: this.id, agreementId: this.agreementId, reason: rejection.message }),
      );
    }
  }

  /**
   * Compares two invoices together and tells if they are the same thing
   */
  public isSameAs(invoice: Invoice) {
    return this.id === invoice.id && this.amount === invoice.amount && this.agreementId === invoice.agreementId;
  }

  protected async refreshStatus() {
    const model = await this.yagnaApi.payment.getInvoice(this.id);
    this.status = model.status;
  }
}
