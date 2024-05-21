import { BasePaymentOptions } from "./config";
import { InvoiceDTO } from "./invoice";
import { DebitNoteDTO } from "./debit_note";

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

export type DebitNoteFilter = (debitNote: DebitNoteDTO) => Promise<boolean> | boolean;
export type InvoiceFilter = (invoice: InvoiceDTO) => Promise<boolean> | boolean;
