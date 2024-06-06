import { Subject } from "rxjs";
import { Invoice } from "./invoice";
import { DebitNote } from "./debit_note";
import { Allocation } from "./allocation";

export type PaymentEvents = {
  allocationCreated: (allocation: Allocation) => void;
  errorCreatingAllocation: (error: Error) => void;

  allocationReleased: (allocation: Allocation) => void;
  errorReleasingAllocation: (allocation: Allocation, error: Error) => void;

  allocationAmended: (allocation: Allocation) => void;
  errorAmendingAllocation: (allocation: Allocation, error: Error) => void;

  invoiceReceived: (invoice: Invoice) => void;
  debitNoteReceived: (debitNote: DebitNote) => void;

  invoiceAccepted: (invoice: Invoice) => void;
  invoiceRejected: (invoice: Invoice) => void;
  errorAcceptingInvoice: (invoice: Invoice, error: Error) => void;
  errorRejectingInvoice: (invoice: Invoice, error: Error) => void;

  debitNoteAccepted: (debitNote: DebitNote) => void;
  debitNoteRejected: (debitNote: DebitNote) => void;
  errorAcceptingDebitNote: (debitNote: DebitNote, error: Error) => void;
  errorRejectingDebitNote: (debitNote: DebitNote, error: Error) => void;
};

export interface IPaymentApi {
  receivedInvoices$: Subject<Invoice>;
  receivedDebitNotes$: Subject<DebitNote>;

  /** Starts the reader logic */
  connect(): Promise<void>;

  /** Terminates the reader logic */
  disconnect(): Promise<void>;

  getInvoice(id: string): Promise<Invoice>;

  acceptInvoice(invoice: Invoice, allocation: Allocation, amount: string): Promise<Invoice>;

  rejectInvoice(invoice: Invoice, reason: string): Promise<Invoice>;

  getDebitNote(id: string): Promise<DebitNote>;

  acceptDebitNote(debitNote: DebitNote, allocation: Allocation, amount: string): Promise<DebitNote>;

  rejectDebitNote(debitNote: DebitNote, reason: string): Promise<DebitNote>;

  getAllocation(id: string): Promise<Allocation>;

  createAllocation(params: CreateAllocationParams): Promise<Allocation>;

  releaseAllocation(allocation: Allocation): Promise<void>;
}

export type CreateAllocationParams = {
  budget: number;
  paymentPlatform: string;
  expirationSec: number;
};
