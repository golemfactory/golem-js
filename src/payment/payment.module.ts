/* eslint-disable @typescript-eslint/no-unused-vars */
import { EventEmitter } from "eventemitter3";
import { Allocation, DebitNote, Invoice, InvoiceProcessor } from "./index";
import { Promise } from "cypress/types/cy-bluebird";

import { defaultLogger, YagnaApi } from "../shared/utils";
import { DebitNoteFilter, InvoiceFilter } from "./service";
import { Observable } from "rxjs";
import { GolemServices } from "../golem-network";
import { PaymentSpec } from "../market";

export interface PaymentModuleOptions {
  debitNoteFilter?: DebitNoteFilter;
  invoiceFilter?: InvoiceFilter;
  payment: PaymentSpec;
}

export interface PaymentPlatformOptions {
  driver: string;
  network: string;
}

export interface PaymentModuleEvents {}

export type CreateAllocationParams = {
  amount: number;
};

export interface PaymentModule {
  events: EventEmitter<PaymentModuleEvents>;

  subscribeForDebitNotes(): Observable<DebitNote>;

  subscribeForInvoices(): Observable<Invoice>;

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
  events: EventEmitter<PaymentModuleEvents> = new EventEmitter<PaymentModuleEvents>();

  private readonly yagnaApi: YagnaApi;

  private readonly logger = defaultLogger("payment");

  private readonly options: PaymentModuleOptions = {
    debitNoteFilter: () => true,
    invoiceFilter: () => true,
    payment: { driver: "erc20", network: "holesky" },
  };

  constructor(deps: GolemServices, options?: PaymentModuleOptions) {
    if (options) {
      this.options = options;
    }

    this.logger = deps.logger;
    this.yagnaApi = deps.yagna;
  }

  subscribeForDebitNotes(): Observable<DebitNote> {
    throw new Error("Method not implemented.");
  }

  subscribeForInvoices(): Observable<Invoice> {
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
