import { BasePaymentOptions } from "./config";
import { DebitNoteFilter, InvoiceFilter } from "./agreement_payment_process";

export interface PaymentOptions extends BasePaymentOptions {
  /** Interval for checking new invoices */
  invoiceFetchingInterval?: number;
  /** Interval for checking new debit notes */
  debitNotesFetchingInterval?: number;
  /** Maximum number of invoice events per one fetching */
  maxInvoiceEvents?: number;
  /** Maximum number of debit notes events per one fetching */
  maxDebitNotesEvents?: number;
  /** A custom filter that checks every debit notes coming from providers */
  debitNotesFilter?: DebitNoteFilter;
  /** A custom filter that checks every invoices coming from providers */
  invoiceFilter?: InvoiceFilter;
}
