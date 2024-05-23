/* eslint-disable @typescript-eslint/no-unused-vars */
import { EventEmitter } from "eventemitter3";
import { Allocation, DebitNote, Invoice, InvoiceProcessor, IPaymentApi } from "./index";

import { defaultLogger, YagnaApi } from "../shared/utils";
import { DebitNoteFilter, InvoiceFilter } from "./service";
import { Observable } from "rxjs";
import { GolemServices } from "../golem-network/golem-network";
import { PayerDetails } from "./PayerDetails";
import { CreateAllocationParams } from "./types";

export interface PaymentModuleOptions {
  debitNoteFilter?: DebitNoteFilter;
  invoiceFilter?: InvoiceFilter;
  /**
   * Network used to facilitate the payment.
   * (for example: "mainnet", "holesky")
   * @default holesky
   */
  network?: string;
  /**
   * Payment driver used to facilitate the payment.
   * (for example: "erc20")
   * @default erc20
   */
  driver?: "erc20";
  /**
   * Token used to facilitate the payment.
   * If unset, it will be inferred from the network.
   * (for example: "glm", "tglm")
   */
  token?: "glm" | "tglm";
}

export interface PaymentModuleEvents {}

export interface PaymentModule {
  events: EventEmitter<PaymentModuleEvents>;

  observeDebitNotes(): Observable<DebitNote>;

  observeInvoices(): Observable<Invoice>;

  createAllocation(params: { budget: number; expirationSec: number }): Promise<Allocation>;

  releaseAllocation(allocation: Allocation): Promise<void>;

  amendAllocation(allocation: Allocation, params: CreateAllocationParams): Promise<Allocation>;

  acceptInvoice(invoice: Invoice, allocation: Allocation, amount: string): Promise<Invoice>;

  rejectInvoice(invoice: Invoice, reason: string): Promise<Invoice>;

  acceptDebitNote(debitNote: DebitNote, allocation: Allocation, amount: string): Promise<DebitNote>;

  rejectDebitNote(debitNote: DebitNote, reason: string): Promise<DebitNote>;

  createInvoiceProcessor(): InvoiceProcessor;

  /**
   * Get the payment platform and wallet address of the payer.
   */
  getPayerDetails(): Promise<PayerDetails>;
}

export class PaymentModuleImpl implements PaymentModule {
  events: EventEmitter<PaymentModuleEvents> = new EventEmitter<PaymentModuleEvents>();

  private readonly yagnaApi: YagnaApi;

  private readonly paymentApi: IPaymentApi;

  private readonly logger = defaultLogger("payment");

  private readonly options: Required<PaymentModuleOptions> = {
    debitNoteFilter: () => true,
    invoiceFilter: () => true,
    driver: "erc20",
    network: "holesky",
    token: "tglm",
  };

  constructor(deps: GolemServices, options?: PaymentModuleOptions) {
    if (options) {
      const network = options.network || this.options.network;
      const driver = options.driver || this.options.driver;
      const debitNoteFilter = options.debitNoteFilter || this.options.debitNoteFilter;
      const invoiceFilter = options.invoiceFilter || this.options.invoiceFilter;
      const token = options.token || (network === "mainnet" ? "glm" : "tglm");
      this.options = { network, driver, token, debitNoteFilter, invoiceFilter };
    }

    this.logger = deps.logger;
    this.yagnaApi = deps.yagna;
    this.paymentApi = deps.paymentApi;
  }

  private getPaymentPlatform(): string {
    const mainnets = ["mainnet", "polygon"];
    const token = mainnets.includes(this.options.network) ? "glm" : "tglm";
    return `${this.options.driver}-${this.options.network}-${token}`;
  }

  async getPayerDetails(): Promise<PayerDetails> {
    const { identity: address } = await this.yagnaApi.identity.getIdentity();

    return new PayerDetails(this.options.network, this.options.driver, address);
  }

  observeDebitNotes(): Observable<DebitNote> {
    return this.paymentApi.receivedDebitNotes$;
  }

  observeInvoices(): Observable<Invoice> {
    return this.paymentApi.receivedInvoices$;
  }

  async createAllocation(params: { budget: number; expirationSec: number }): Promise<Allocation> {
    const payer = await this.getPayerDetails();

    this.logger.info("Creating allocation", { params: params, payer });

    return this.paymentApi.createAllocation({
      budget: params.budget,
      paymentPlatform: this.getPaymentPlatform(),
      expirationSec: params.expirationSec,
    });
  }

  releaseAllocation(allocation: Allocation): Promise<void> {
    this.logger.info("Releasing allocation", { id: allocation.id });
    return this.paymentApi.releaseAllocation(allocation);
  }

  amendAllocation(allocation: Allocation, _newOpts: CreateAllocationParams): Promise<Allocation> {
    throw new Error("Method not implemented.");
  }

  acceptInvoice(invoice: Invoice, allocation: Allocation, amount: string): Promise<Invoice> {
    this.logger.info("Accepting invoice", { id: invoice.id, allocation: allocation.id, amount });
    return this.paymentApi.acceptInvoice(invoice, allocation, amount);
  }

  rejectInvoice(invoice: Invoice, reason: string): Promise<Invoice> {
    this.logger.info("Rejecting invoice", { id: invoice.id, reason });
    return this.paymentApi.rejectInvoice(invoice, reason);
  }

  acceptDebitNote(debitNote: DebitNote, allocation: Allocation, amount: string): Promise<DebitNote> {
    this.logger.info("Accepting debit note", { id: debitNote.id, allocation: allocation.id, amount });
    return this.paymentApi.acceptDebitNote(debitNote, allocation, amount);
  }

  rejectDebitNote(debitNote: DebitNote, reason: string): Promise<DebitNote> {
    this.logger.info("Rejecting debit note", { id: debitNote.id, reason });
    return this.paymentApi.rejectDebitNote(debitNote, reason);
  }

  /**
   * Creates an instance of utility class InvoiceProcessor that deals with invoice related use-cases
   */
  createInvoiceProcessor(): InvoiceProcessor {
    return new InvoiceProcessor(this.yagnaApi);
  }
}
