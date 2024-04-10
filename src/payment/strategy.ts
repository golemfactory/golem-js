import { DebitNoteDTO } from "./debit_note";
import { InvoiceDTO } from "./invoice";
import Decimal from "decimal.js-light";

/** Default DebitNotes filter that accept all debit notes without any validation */
export const acceptAllDebitNotesFilter = () => async () => true;

/** Default Invoices filter that accept all invoices without any validation */
export const acceptAllInvoicesFilter = () => async () => true;

/** A custom filter that only accepts debit notes below a given value */
export const acceptMaxAmountDebitNoteFilter = (maxAmount: number) => async (debitNote: DebitNoteDTO) =>
  new Decimal(debitNote.totalAmountDue).lte(maxAmount);

/** A custom filter that only accepts invoices below a given value */
export const acceptMaxAmountInvoiceFilter = (maxAmount: number) => async (invoice: InvoiceDTO) =>
  new Decimal(invoice.amount).lte(maxAmount);
