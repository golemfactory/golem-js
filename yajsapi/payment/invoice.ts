import { BasePaymentOptions, InvoiceConfig } from "./config.js";
import { Invoice as Model, InvoiceStatus } from "ya-ts-client/dist/ya-payment/src/models/index.js";
import { Events } from "../events/index.js";
import { Rejection } from "./rejection.js";

export type InvoiceOptions = BasePaymentOptions;

interface BaseModel {
  issuerId: string;
  recipientId: string;
  payeeAddr: string;
  payerAddr: string;
  paymentPlatform: string;
  agreementId: string;
  paymentDueDate?: string;
  status: InvoiceStatus;
}

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

  protected constructor(model: ModelType, protected options: InvoiceConfig) {
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
    return this.status;
  }
  protected abstract accept(totalAmountAccepted: string, allocationId: string): Promise<void>;
  protected abstract reject(rejection: Rejection): Promise<void>;
  protected abstract refreshStatus(): Promise<void>;
}

/**
 * @category Mid-level
 */
export class Invoice extends BaseNote<Model> {
  /** Invoice ID */
  public readonly id: string;
  /** Activities IDs covered by this Invoice */
  public readonly activityIds?: string[];
  /** Amount in the invoice */
  public readonly amount: string;
  /** Invoice creation timestamp */
  public readonly timestamp: string;
  /** Recipient ID */
  public readonly recipientId: string;

  /**
   * Create invoice using invoice ID
   *
   * @param invoiceId - Invoice ID
   * @param options - {@link InvoiceOptions}
   */
  static async create(invoiceId: string, options?: InvoiceOptions): Promise<Invoice> {
    const config = new InvoiceConfig(options);
    const { data: model } = await config.api.getInvoice(invoiceId);
    return new Invoice(model, config);
  }

  protected constructor(model: Model, protected options: InvoiceConfig) {
    super(model, options);
    this.id = model.invoiceId;
    this.activityIds = model.activityIds;
    this.amount = model.amount;
    this.timestamp = model.timestamp;
    this.recipientId = model.recipientId;
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
  async accept(totalAmountAccepted: string, allocationId: string) {
    try {
      await this.options.api.acceptInvoice(this.id, { totalAmountAccepted, allocationId });
    } catch (e) {
      const reason = e?.response?.data?.message || e;
      this.options.eventTarget?.dispatchEvent(
        new Events.PaymentFailed({ id: this.id, agreementId: this.agreementId, reason })
      );
      throw new Error(`Unable to accept invoice ${this.id} ${reason}`);
    }
    this.options.eventTarget?.dispatchEvent(new Events.PaymentAccepted(this));
  }

  /**
   * Reject Invoice
   *
   * @param rejection - {@link Rejection}
   */
  async reject(rejection: Rejection) {
    try {
      await this.options.api.rejectInvoice(this.id, rejection);
    } catch (e) {
      throw new Error(`Unable to reject invoice ${this.id} ${e?.response?.data?.message || e}`);
    } finally {
      this.options.eventTarget?.dispatchEvent(
        new Events.PaymentFailed({ id: this.id, agreementId: this.agreementId, reason: rejection.message })
      );
    }
  }

  protected async refreshStatus() {
    const { data: model } = await this.options.api.getInvoice(this.id);
    this.status = model.status;
  }
}
