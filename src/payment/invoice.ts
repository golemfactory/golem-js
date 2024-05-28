import { BasePaymentOptions } from "./config";
import { PaymentApi } from "ya-ts-client";
import { ProviderInfo } from "../market/agreement";
import { BaseDocument } from "./BaseDocument";
import Decimal from "decimal.js-light";

export type InvoiceOptions = BasePaymentOptions;

export interface IInvoiceRepository {
  getById(id: string): Promise<Invoice>;
}

/**
 * An Invoice is an artifact issued by the Provider to the Requestor, in the context of a specific Agreement. It indicates the total Amount owed by the Requestor in this Agreement. No further Debit Notes shall be issued after the Invoice is issued. The issue of Invoice signals the Termination of the Agreement (if it hasn't been terminated already). No Activity execution is allowed after the Invoice is issued.
 */
export class Invoice extends BaseDocument<PaymentApi.InvoiceDTO> {
  /** Activities IDs covered by this Invoice */
  public readonly activityIds?: string[];
  /** Amount in the invoice */
  public readonly amount: string;
  /** Invoice creation timestamp */
  public readonly timestamp: string;
  /** Recipient ID */
  public readonly recipientId: string;

  /**
   * @param model
   * @param providerInfo
   */
  public constructor(
    protected model: PaymentApi.InvoiceDTO,
    providerInfo: ProviderInfo,
  ) {
    super(model.invoiceId, model, providerInfo);
    this.activityIds = model.activityIds;
    this.amount = model.amount;
    this.timestamp = model.timestamp;
    this.recipientId = model.recipientId;
  }

  public getPreciseAmount(): Decimal {
    return new Decimal(this.amount);
  }

  /**
   * Compares two invoices together and tells if they are the same thing
   */
  public isSameAs(invoice: Invoice) {
    return this.id === invoice.id && this.amount === invoice.amount && this.agreementId === invoice.agreementId;
  }
}
