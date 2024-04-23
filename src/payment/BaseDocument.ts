import { PaymentApi } from "ya-ts-client";
import { EventEmitter } from "eventemitter3";
import { ProviderInfo } from "../agreement";
import { InvoiceEvents } from "./invoice";

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
 * Common properties and methods for payment related documents - Invoices and DebitNotes
 */
export abstract class BaseDocument<ModelType extends BaseModel> {
  public readonly recipientId: string;
  public readonly payeeAddr: string;
  public readonly requestorWalletAddress: string;
  public readonly paymentPlatform: string;
  public readonly agreementId: string;
  public readonly paymentDueDate?: string;

  protected status: PaymentApi.InvoiceDTO["status"];

  public readonly events = new EventEmitter<InvoiceEvents>();

  protected constructor(
    public readonly id: string,
    protected model: ModelType,
    public readonly provider: ProviderInfo,
  ) {
    this.recipientId = model.recipientId;
    this.payeeAddr = model.payeeAddr;
    this.requestorWalletAddress = model.payerAddr;
    this.paymentPlatform = model.paymentPlatform;
    this.agreementId = model.agreementId;
    this.paymentDueDate = model.paymentDueDate;
    this.status = model.status;
  }

  /**
   * Tells what's the current status of the document
   */
  public getStatus() {
    return this.status;
  }

  /**
   * Tells if the requestor should do anything about the document
   */
  public isPendingAction() {
    return this.status === "RECEIVED";
  }
}
