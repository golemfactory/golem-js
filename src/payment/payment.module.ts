/* eslint-disable @typescript-eslint/no-unused-vars */
import { EventEmitter } from "eventemitter3";
import { Allocation, DebitNote, Invoice, InvoiceProcessor } from "./index";

import { defaultLogger, Logger, YagnaApi } from "../shared/utils";
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
  budget: number;
};

export type PaymentModuleConfig = {
  /**
   * Payment network. During development it's recommended to use the `holesky` testnet.
   * For production use `mainnet` or `polygon`.
   * Payments on mainnets use real GLM tokens, while on testnets they use tGLM (test glm) tokens.
   * @default holesky
   */
  network?: string;
  /**
   * Instruct yagna to use a specific payment driver.
   * @default erc20
   */
  driver?: string;

  logger?: Logger;
};

export interface PayerDetails {
  address: string;
  platform: string;
}

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

  /**
   * Get the payment platform and wallet address of the payer.
   */
  getPayerDetails(): Promise<PayerDetails>;
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

  private getPaymentPlatform(): string {
    const mainnets = ["mainnet", "polygon"];
    const token = mainnets.includes(this.options.payment.network) ? "glm" : "tglm";
    return `${this.options.payment.driver}-${this.options.payment.network}-${token}`;
  }

  async getPayerDetails(): Promise<PayerDetails> {
    const { identity: address } = await this.yagnaApi.identity.getIdentity();

    return {
      address,
      platform: this.getPaymentPlatform(),
    };
  }

  subscribeForDebitNotes(): Observable<DebitNote> {
    throw new Error("Method not implemented.");
  }

  subscribeForInvoices(): Observable<Invoice> {
    throw new Error("Method not implemented.");
  }

  async createAllocation(allocationParams: CreateAllocationParams): Promise<Allocation> {
    const account = await this.getPayerDetails();
    return Allocation.create(this.yagnaApi, {
      account,
      ...allocationParams,
    });
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
