import { DebitNoteDTO } from "./debit_note";
import { InvoiceDTO } from "./invoice";

export const AcceptAllDebitNotesFilter = () => async () => true;
export const AcceptAllInvoicesFilter = () => async () => true;

export const AcceptMaxAmountDebitNoteFilter = (maxAmount: number) => async (debitNote: DebitNoteDTO) =>
  debitNote.totalAmountDue <= maxAmount;

export const AcceptMaxAmountInvoiceFilter = (maxAmount: number) => async (invoice: InvoiceDTO) =>
  invoice.amount <= maxAmount;
