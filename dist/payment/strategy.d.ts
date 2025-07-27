import { DebitNote } from "./debit_note";
import { Invoice } from "./invoice";
/** Default DebitNotes filter that accept all debit notes without any validation */
export declare const acceptAllDebitNotesFilter: () => () => Promise<boolean>;
/** Default Invoices filter that accept all invoices without any validation */
export declare const acceptAllInvoicesFilter: () => () => Promise<boolean>;
/** A custom filter that only accepts debit notes below a given value */
export declare const acceptMaxAmountDebitNoteFilter: (maxAmount: number) => (debitNote: DebitNote) => Promise<boolean>;
/** A custom filter that only accepts invoices below a given value */
export declare const acceptMaxAmountInvoiceFilter: (maxAmount: number) => (invoice: Invoice) => Promise<boolean>;
