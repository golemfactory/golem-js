import { BasePaymentOptions, InvoiceConfig } from "./config";
import { Invoice as Model, InvoiceStatus } from "ya-ts-client/dist/ya-payment/src/models";
import { Events } from "../events";
import { Rejection } from "./rejection";
import { YagnaApi } from "../utils";
import { GolemError } from "../error/golem-error";

export type InvoiceOptions = BasePaymentOptions;

export interface InvoiceDTO {
  id: string;
  providerId: string;
  timestamp: string;
  activityIds?: string[];
  agreementId: string;
  paymentDueDate?: string;
  status: string;
  payeeAddr: string;
  payerAddr: string;
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
  status: InvoiceStatus;
}

/**
 * @hidden
 */
export abstract class BaseNote<ModelType extends BaseModel> {
  public abstract readonly id: string;
  public readonly providerId: string;
  public readonly recipientId: string;
  public readonly payeeAddr: string;
  public readonly payerAddr: string;
  public readonly paymentPlatform: string;
  public readonly agreementId: string;
  public readonly paymentDueDate?: string;
  protected status: InvoiceStatus;

  protected constructor(
    protected model: ModelType,
    protected options: InvoiceConfig,
  ) {
    this.providerId = model.issuerId;
    this.recipientId = model.recipientId;
    this.payeeAddr = model.payeeAddr;
    this.payerAddr = model.payerAddr;
    this.paymentPlatform = model.paymentPlatform;
    this.agreementId = model.agreementId;
    this.paymentDueDate = model.paymentDueDate;
    this.status = model.status;
  }
  protected async getStatus(): Promise<InvoiceStatus> {
    await this.refreshStatus();
    return this.model.status;
  }
  protected abstract accept(totalAmountAccepted: number, allocationId: string): Promise<void>;
  protected abstract reject(rejection: Rejection): Promise<void>;
  protected abstract refreshStatus(): Promise<void>;
}

/**
 * An Invoice is an artifact issued by the Provider to the Requestor, in the context of a specific Agreement. It indicates the total Amount owed by the Requestor in this Agreement. No further Debit Notes shall be issued after the Invoice is issued. The issue of Invoice signals the Termination of the Agreement (if it hasn't been terminated already). No Activity execution is allowed after the Invoice is issued.
 * @hidden
 */
export class Invoice extends BaseNote<Model> {
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
    const { data: model } = await yagnaApi.payment.getInvoice(invoiceId);
    return new Invoice(model, yagnaApi, config);
  }

  /**
   * @param model
   * @param yagnaApi
   * @param options
   * @protected
   * @hidden
   */
  protected constructor(
    protected model: Model,
    protected yagnaApi: YagnaApi,
    protected options: InvoiceConfig,
  ) {
    super(model, options);
    this.id = model.invoiceId;
    this.activityIds = model.activityIds;
    this.amount = Number(model.amount);
    this.timestamp = model.timestamp;
    this.recipientId = model.recipientId;
  }

  get dto(): InvoiceDTO {
    return {
      id: this.id,
      providerId: this.providerId,
      timestamp: this.timestamp,
      activityIds: this.activityIds,
      agreementId: this.agreementId,
      paymentDueDate: this.paymentDueDate,
      status: this.status,
      payeeAddr: this.payeeAddr,
      payerAddr: this.payerAddr,
      paymentPlatform: this.paymentPlatform,
      amount: this.amount,
    };
  }

  /**
   * Get Invoice Status
   *
   * @return {@link InvoiceStatus}
   */
  async getStatus(): Promise<InvoiceStatus> {
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
    } catch (e) {
      const reason = e?.response?.data?.message || e;
      this.options.eventTarget?.dispatchEvent(
        new Events.PaymentFailed({ id: this.id, agreementId: this.agreementId, reason }),
      );
      throw new GolemError(`Unable to accept invoice ${this.id} ${reason}`);
    }
    this.options.eventTarget?.dispatchEvent(
      new Events.PaymentAccepted({
        id: this.id,
        providerId: this.providerId,
        agreementId: this.agreementId,
        amount: this.amount,
        payeeAddr: this.payeeAddr,
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
    } catch (e) {
      throw new GolemError(`Unable to reject invoice ${this.id} ${e?.response?.data?.message || e}`);
    } finally {
      this.options.eventTarget?.dispatchEvent(
        new Events.PaymentFailed({ id: this.id, agreementId: this.agreementId, reason: rejection.message }),
      );
    }
  }

  protected async refreshStatus() {
    const { data: model } = await this.yagnaApi.payment.getInvoice(this.id);
    this.status = model.status;
  }
}
