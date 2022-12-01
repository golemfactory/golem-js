import { BasePaymentOptions, InvoiceConfig } from "./config";
import { Invoice as Model } from "ya-ts-client/dist/ya-payment/src/models";
import { InvoiceStatus } from "ya-ts-client/dist/ya-payment/src/models/invoice-status";

export type InvoiceOptions = BasePaymentOptions;

export class Invoice {
  public readonly id: string;
  public readonly issuerId: string;
  public readonly recipientId: string;
  public readonly payeeAddr: string;
  public readonly payerAddr: string;
  public readonly paymentPlatform: string;
  public readonly agreementId: string;
  public readonly activityIds?: string[];
  public readonly amount: string;
  public readonly paymentDueDate: string;
  private status: InvoiceStatus;

  static async create(invoiceId: string, options?: InvoiceOptions) {
    const config = new InvoiceConfig(options);
    const { data: model } = await config.api.getInvoice(invoiceId);
    return new Invoice(model, config);
  }
  private constructor(model: Model, private options: InvoiceConfig) {
    this.id = model.invoiceId;
    this.issuerId = model.issuerId;
    this.recipientId = model.recipientId;
    this.payeeAddr = model.payeeAddr;
    this.payerAddr = model.payerAddr;
    this.paymentPlatform = model.paymentPlatform;
    this.agreementId = model.agreementId;
    this.activityIds = model.activityIds;
    this.amount = model.amount;
    this.paymentDueDate = model.paymentDueDate;
    this.status = model.status;
  }

  async getStatus(): Promise<InvoiceStatus> {
    await this.refreshStatus();
    return this.status;
  }

  async accept(amount: number, allocationId: string) {
    await this.options.api.acceptInvoice(this.id, { totalAmountAccepted: amount.toString(), allocationId });
  }

  async reject() {
    await this.options.api.rejectInvoice(this.id);
  }

  private async refreshStatus() {
    const { data: model } = await this.options.api.getInvoice(this.id);
    this.status = model.status;
  }
}
