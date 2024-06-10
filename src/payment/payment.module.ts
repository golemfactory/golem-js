import { EventEmitter } from "eventemitter3";
import {
  Allocation,
  DebitNote,
  Invoice,
  InvoiceProcessor,
  IPaymentApi,
  CreateAllocationParams,
  PaymentEvents,
} from "./index";
import { defaultLogger, YagnaApi } from "../shared/utils";
import { Observable } from "rxjs";
import { GolemServices } from "../golem-network/golem-network";
import { PayerDetails } from "./PayerDetails";
import { AgreementPaymentProcess, PaymentProcessOptions } from "./agreement_payment_process";
import { Agreement } from "../market";
import * as EnvUtils from "../shared/utils/env";

export interface PaymentModuleOptions {
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

export interface PaymentModule {
  events: EventEmitter<PaymentEvents>;

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

  createAgreementPaymentProcess(
    agreement: Agreement,
    allocation: Allocation,
    options?: Partial<PaymentProcessOptions>,
  ): AgreementPaymentProcess;

  /**
   * Get the payment platform and wallet address of the payer.
   */
  getPayerDetails(): Promise<PayerDetails>;
}

const MAINNETS = Object.freeze(["mainnet", "polygon"]);

export class PaymentModuleImpl implements PaymentModule {
  events: EventEmitter<PaymentEvents> = new EventEmitter<PaymentEvents>();

  private readonly yagnaApi: YagnaApi;

  private readonly paymentApi: IPaymentApi;

  private readonly logger = defaultLogger("payment");

  private readonly options: Required<PaymentModuleOptions> = {
    driver: "erc20",
    network: EnvUtils.getPaymentNetwork(),
    token: "tglm",
  };

  constructor(deps: GolemServices, options?: PaymentModuleOptions) {
    if (options) {
      const network = options.network || this.options.network;
      const driver = options.driver || this.options.driver;
      const token = options.token || MAINNETS.includes(network) ? "glm" : "tglm";
      this.options = { network, driver, token };
    }

    this.logger = deps.logger;
    this.yagnaApi = deps.yagna;
    this.paymentApi = deps.paymentApi;
    this.startEmittingPaymentEvents();
  }

  private startEmittingPaymentEvents() {
    this.paymentApi.receivedInvoices$.subscribe((invoice) => {
      this.events.emit("invoiceReceived", invoice);
    });

    this.paymentApi.receivedDebitNotes$.subscribe((debitNote) => {
      this.events.emit("debitNoteReceived", debitNote);
    });
  }

  private getPaymentPlatform(): string {
    return `${this.options.driver}-${this.options.network}-${this.options.token}`;
  }

  async getPayerDetails(): Promise<PayerDetails> {
    const { identity: address } = await this.yagnaApi.identity.getIdentity();

    return new PayerDetails(this.options.network, this.options.driver, address, this.options.token);
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

    try {
      const allocation = await this.paymentApi.createAllocation({
        budget: params.budget,
        paymentPlatform: this.getPaymentPlatform(),
        expirationSec: params.expirationSec,
      });
      this.events.emit("allocationCreated", allocation);
      return allocation;
    } catch (error) {
      this.events.emit("errorCreatingAllocation", error);
      throw error;
    }
  }

  async releaseAllocation(allocation: Allocation): Promise<void> {
    this.logger.info("Releasing allocation", { id: allocation.id });
    try {
      await this.paymentApi.releaseAllocation(allocation);
      this.events.emit("allocationReleased", allocation);
    } catch (error) {
      this.events.emit("errorReleasingAllocation", allocation, error);
      throw error;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  amendAllocation(allocation: Allocation, _newOpts: CreateAllocationParams): Promise<Allocation> {
    this.events.emit("errorAmendingAllocation", allocation, new Error("Amending allocation is not supported yet"));
    throw new Error("Amending allocation is not supported yet");
  }

  async acceptInvoice(invoice: Invoice, allocation: Allocation, amount: string): Promise<Invoice> {
    this.logger.info("Accepting invoice", { id: invoice.id, allocation: allocation.id, amount });
    try {
      const acceptedInvoice = await this.paymentApi.acceptInvoice(invoice, allocation, amount);
      this.events.emit("invoiceAccepted", acceptedInvoice);
      return acceptedInvoice;
    } catch (error) {
      this.events.emit("errorAcceptingInvoice", invoice, error);
      throw error;
    }
  }

  async rejectInvoice(invoice: Invoice, reason: string): Promise<Invoice> {
    this.logger.info("Rejecting invoice", { id: invoice.id, reason });
    try {
      const rejectedInvoice = await this.paymentApi.rejectInvoice(invoice, reason);
      this.events.emit("invoiceRejected", rejectedInvoice);
      return rejectedInvoice;
    } catch (error) {
      this.events.emit("errorRejectingInvoice", invoice, error);
      throw error;
    }
  }

  async acceptDebitNote(debitNote: DebitNote, allocation: Allocation, amount: string): Promise<DebitNote> {
    this.logger.info("Accepting debit note", { id: debitNote.id, allocation: allocation.id, amount });
    try {
      const acceptedDebitNote = await this.paymentApi.acceptDebitNote(debitNote, allocation, amount);
      this.events.emit("debitNoteAccepted", acceptedDebitNote);
      return acceptedDebitNote;
    } catch (error) {
      this.events.emit("errorAcceptingDebitNote", debitNote, error);
      throw error;
    }
  }

  async rejectDebitNote(debitNote: DebitNote, reason: string): Promise<DebitNote> {
    this.logger.info("Rejecting debit note", { id: debitNote.id, reason });
    try {
      const rejectedDebitNote = await this.paymentApi.rejectDebitNote(debitNote, reason);
      this.events.emit("debitNoteRejected", rejectedDebitNote);
      return rejectedDebitNote;
    } catch (error) {
      this.events.emit("errorRejectingDebitNote", debitNote, error);
      throw error;
    }
  }

  /**
   * Creates an instance of utility class InvoiceProcessor that deals with invoice related use-cases
   */
  createInvoiceProcessor(): InvoiceProcessor {
    return new InvoiceProcessor(this.yagnaApi);
  }

  createAgreementPaymentProcess(
    agreement: Agreement,
    allocation: Allocation,
    options?: Partial<PaymentProcessOptions>,
  ): AgreementPaymentProcess {
    return new AgreementPaymentProcess(
      agreement,
      allocation,
      this,
      options,
      this.logger.child("agreement-payment-process"),
    );
  }
}
