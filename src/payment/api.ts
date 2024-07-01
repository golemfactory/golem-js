import { Subject } from "rxjs";
import { Invoice } from "./invoice";
import { DebitNote } from "./debit_note";
import { Allocation } from "./allocation";

export type PaymentEvents = {
  allocationCreated: (event: { allocation: Allocation }) => void;
  errorCreatingAllocation: (event: { error: Error }) => void;

  allocationReleased: (event: { allocation: Allocation }) => void;
  errorReleasingAllocation: (event: { allocation: Allocation; error: Error }) => void;

  allocationAmended: (event: { allocation: Allocation }) => void;
  errorAmendingAllocation: (event: { allocation: Allocation; error: Error }) => void;

  invoiceReceived: (event: { invoice: Invoice }) => void;
  debitNoteReceived: (event: { debitNote: DebitNote }) => void;

  invoiceAccepted: (event: { invoice: Invoice }) => void;
  invoiceRejected: (event: { invoice: Invoice }) => void;
  errorAcceptingInvoice: (event: { invoice: Invoice; error: Error }) => void;
  errorRejectingInvoice: (event: { invoice: Invoice; error: Error }) => void;

  debitNoteAccepted: (event: { debitNote: DebitNote }) => void;
  debitNoteRejected: (event: { debitNote: DebitNote }) => void;
  errorAcceptingDebitNote: (event: { debitNote: DebitNote; error: Error }) => void;
  errorRejectingDebitNote: (event: { debitNote: DebitNote; error: Error }) => void;
};

export interface IPaymentApi {
  receivedInvoices$: Subject<Invoice>;
  receivedDebitNotes$: Subject<DebitNote>;

  /** Starts the reader logic */
  connect(): Promise<void>;

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
  /**
   * How much to allocate
   */
  budget: number;
  /**
   * How long the allocation should be valid
   */
  expirationSec: number;
  /**
   * Optionally override the payment platform to use for this allocation
   */
  paymentPlatform?: string;
  /**
   * Optionally provide a deposit to be used for the allocation, instead of using funds from the yagna wallet.
   * Deposit is a way to pay for the computation using someone else's funds. The other party has to
   * call the `createDeposit` method on the `LockPayment` smart contract and provide the deposit ID.
   */
  deposit?: {
    /**
     * Address of the smart contract that holds the deposit.
     */
    contract: string;
    /**
     * ID of the deposit, obtained by calling the `createDeposit` method on the smart contract.
     */
    id: string;
  };
};
