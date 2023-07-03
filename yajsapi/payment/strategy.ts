import { DebitNoteDTO } from "./debit_note";
import { InvoiceDTO } from "./invoice";

/** Default DebitNotes filter that accept all debit notes without any validation */
export const AcceptAllDebitNotesFilter = () => async () => true;
/** Default Invoices filter that accept all invoices without any validation */
export const AcceptAllInvoicesFilter = () => async () => true;

/** A custom filter that only accepts debit notes below a given value */
export const AcceptMaxAmountDebitNoteFilter = (maxAmount: number) => async (debitNote: DebitNoteDTO) =>
  debitNote.totalAmountDue <= maxAmount;

/** A custom filter that only accepts invoices below a given value */
export const AcceptMaxAmountInvoiceFilter = (maxAmount: number) => async (invoice: InvoiceDTO) =>
  invoice.amount <= maxAmount;
