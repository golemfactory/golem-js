import { Subject } from "rxjs";
import { Invoice } from "./invoice";
import { DebitNote } from "./debit_note";
import { Allocation } from "./allocation";

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
