/* eslint-disable @typescript-eslint/no-unused-vars */
import { EventEmitter } from "eventemitter3";
import { Allocation, DebitNote, Invoice, InvoiceProcessor } from "./index";
import { Promise } from "cypress/types/cy-bluebird";

import { YagnaEventSubscription } from "../utils";

export interface PaymentEvents {}

export type CreateAllocationParams = {
  amount: number;
};

export interface PaymentModule {
  events: EventEmitter<PaymentEvents>;

  subscribeForDebitNotes(): YagnaEventSubscription<DebitNote>;

  subscribeForInvoices(): YagnaEventSubscription<Invoice>;

  createAllocation(opts: CreateAllocationParams): Promise<Allocation>;

  // alt. Allocation.release()
  releaseAllocation(allocation: Allocation): Promise<Allocation>;

  // alt Allocation.amend()
  amendAllocation(allocation: Allocation, newOpts: CreateAllocationParams): Promise<Allocation>;

  // alt Invoice.accept()
  acceptInvoice(invoice: Invoice): Promise<Invoice>;

  // alt Invoice.reject()
  rejectInvoice(invoice: Invoice): Promise<Invoice>;

  // alt DebitNote.accept()
  acceptDebitNote(debitNote: DebitNote): Promise<DebitNote>;

  // alt DebitNote.reject()
  rejectDebitNote(debitNote: DebitNote): Promise<DebitNote>;

  createInvoiceProcessor(): InvoiceProcessor;
}

export class PaymentModuleImpl implements PaymentModule {
  events: EventEmitter<PaymentEvents> = new EventEmitter<PaymentEvents>();

  subscribeForDebitNotes(): YagnaEventSubscription<DebitNote> {
    throw new Error("Method not implemented.");
  }

  subscribeForInvoices(): YagnaEventSubscription<Invoice> {
    throw new Error("Method not implemented.");
  }

  createAllocation(_opts: CreateAllocationParams): Promise<Allocation> {
    throw new Error("Method not implemented.");
  }

  releaseAllocation(_allocation: Allocation): Promise<Allocation> {
    throw new Error("Method not implemented.");
  }

  amendAllocation(_allocation: Allocation, _newOpts: CreateAllocationParams): Promise<Allocation> {
    throw new Error("Method not implemented.");
  }

  acceptInvoice(_invoice: Invoice): Promise<Invoice> {
    throw new Error("Method not implemented.");
  }

  rejectInvoice(_invoice: Invoice): Promise<Invoice> {
    throw new Error("Method not implemented.");
  }

  acceptDebitNote(_debitNote: DebitNote): Promise<DebitNote> {
    throw new Error("Method not implemented.");
  }

  rejectDebitNote(_debitNote: DebitNote): Promise<DebitNote> {
    throw new Error("Method not implemented.");
  }

  createInvoiceProcessor(): InvoiceProcessor {
    throw new Error("Method not implemented.");
  }
}
