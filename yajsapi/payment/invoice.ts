import { BasePaymentOptions, InvoiceConfig } from "./config";
import { Invoice as Model, InvoiceStatus, Rejection } from "ya-ts-client/dist/ya-payment/src/models";

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
  public readonly issuerId: string;
  public readonly recipientId: string;
  public readonly payeeAddr: string;
  public readonly payerAddr: string;
  public readonly paymentPlatform: string;
  public readonly agreementId: string;
  public readonly paymentDueDate?: string;
  protected status: InvoiceStatus;

  static async create(debitNoteId: string, options?: InvoiceOptions) {
    const config = new InvoiceConfig(options);
    const { data: model } = await config.api.getDebitNote(debitNoteId);
    const { constructor } = Object.getPrototypeOf(this);
    return new constructor(model, config)();
  }

  protected constructor(model: ModelType, protected options: InvoiceConfig) {
    this.issuerId = model.issuerId;
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
  protected abstract accept(amount: number, allocationId: string): Promise<void>;
  protected abstract reject(rejection: Rejection): Promise<void>;
  protected abstract refreshStatus(): Promise<void>;
}

export class Invoice extends BaseNote<Model> {
  public readonly id: string;
  public readonly activityIds?: string[];
  public readonly amount: string;
  public readonly timestamp: string;
  public readonly recipientId: string;

  protected constructor(model: Model, protected options: InvoiceConfig) {
    super(model, options);
    this.id = model.invoiceId;
    this.activityIds = model.activityIds;
    this.amount = model.amount;
    this.timestamp = model.timestamp;
    this.recipientId = model.recipientId;
  }
  async getStatus(): Promise<InvoiceStatus> {
    await this.refreshStatus();
    return this.status;
  }
  async accept(amount: number, allocationId: string) {
    await this.options.api.acceptInvoice(this.id, { totalAmountAccepted: amount.toString(), allocationId });
  }
  async reject(rejection: Rejection) {
    await this.options.api.rejectInvoice(this.id, rejection);
  }
  protected async refreshStatus() {
    const { data: model } = await this.options.api.getInvoice(this.id);
    this.status = model.status;
  }
}
