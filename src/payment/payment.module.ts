import { EventEmitter } from "eventemitter3";
import {
  Allocation,
  CreateAllocationParams,
  DebitNote,
  Invoice,
  InvoiceProcessor,
  IPaymentApi,
  PaymentEvents,
} from "./index";
import { defaultLogger, YagnaApi } from "../shared/utils";
import { Observable } from "rxjs";
import { GolemServices } from "../golem-network";
import { PayerDetails } from "./PayerDetails";
import { AgreementPaymentProcess, PaymentProcessOptions } from "./agreement_payment_process";
import { Agreement } from "../market";
import * as EnvUtils from "../shared/utils/env";
import { GolemInternalError } from "../shared/error/golem-error";

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
  // eslint-disable-next-line @typescript-eslint/ban-types -- keep the autocomplete for "erc20" but allow any string
  driver?: "erc20" | (string & {});
  /**
   * Token used to facilitate the payment.
   * If unset, it will be inferred from the network.
   * (for example: "glm", "tglm")
   */
  // eslint-disable-next-line @typescript-eslint/ban-types -- keep the autocomplete for "glm" and "tglm" but allow any string
  token?: "glm" | "tglm" | (string & {});
}

export interface PaymentModule {
  events: EventEmitter<PaymentEvents>;

  observeDebitNotes(): Observable<DebitNote>;

  observeInvoices(): Observable<Invoice>;

  createAllocation(params: CreateAllocationParams): Promise<Allocation>;

  releaseAllocation(allocation: Allocation): Promise<void>;

  amendAllocation(allocation: Allocation, params: CreateAllocationParams): Promise<Allocation>;

  getAllocation(id: string): Promise<Allocation>;

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
    const network = options?.network ?? this.options.network;
    const driver = options?.driver ?? this.options.driver;
    const token = options?.token ?? MAINNETS.includes(network) ? "glm" : "tglm";
    this.options = { network, driver, token };

    this.logger = deps.logger;
    this.yagnaApi = deps.yagna;
    this.paymentApi = deps.paymentApi;

    this.startEmittingPaymentEvents();
  }

  private startEmittingPaymentEvents() {
    this.paymentApi.receivedInvoices$.subscribe((invoice) => {
      this.events.emit("invoiceReceived", {
        invoice,
      });
    });

    this.paymentApi.receivedDebitNotes$.subscribe((debitNote) => {
      this.events.emit("debitNoteReceived", { debitNote });
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

  async createAllocation(params: CreateAllocationParams): Promise<Allocation> {
    this.logger.debug("Creating allocation", { params: params });

    try {
      const allocation = await this.paymentApi.createAllocation({
        paymentPlatform: this.getPaymentPlatform(),
        ...params,
      });
      this.events.emit("allocationCreated", { allocation });
      this.logger.info("Created allocation", {
        allocationId: allocation.id,
        budget: allocation.totalAmount,
        platform: this.getPaymentPlatform(),
      });
      this.logger.debug("Created allocation", allocation);
      return allocation;
    } catch (error) {
      this.events.emit("errorCreatingAllocation", error);
      throw error;
    }
  }

  async releaseAllocation(allocation: Allocation): Promise<void> {
    this.logger.debug("Releasing allocation", allocation);
    try {
      const lastKnownAllocationState = await this.getAllocation(allocation.id).catch(() => {
        this.logger.warn("Failed to fetch allocation before releasing", { id: allocation.id });
        return allocation;
      });
      await this.paymentApi.releaseAllocation(allocation);
      this.events.emit("allocationReleased", {
        allocation: lastKnownAllocationState,
      });
      this.logger.info("Released allocation", {
        allocationId: lastKnownAllocationState.id,
        totalAmount: lastKnownAllocationState.totalAmount,
        spentAmount: lastKnownAllocationState.spentAmount,
      });
    } catch (error) {
      this.events.emit("errorReleasingAllocation", {
        allocation: await this.paymentApi.getAllocation(allocation.id).catch(() => {
          this.logger.warn("Failed to fetch allocation after failed release attempt", { id: allocation.id });
          return allocation;
        }),
        error,
      });
      throw error;
    }
  }

  getAllocation(id: string): Promise<Allocation> {
    this.logger.debug("Fetching allocation by id", { id });
    return this.paymentApi.getAllocation(id);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  amendAllocation(allocation: Allocation, _newOpts: CreateAllocationParams): Promise<Allocation> {
    const err = Error("Amending allocation is not supported yet");

    this.events.emit("errorAmendingAllocation", {
      allocation,
      error: err,
    });

    throw err;
  }

  async acceptInvoice(invoice: Invoice, allocation: Allocation, amount: string): Promise<Invoice> {
    this.logger.debug("Accepting invoice", invoice);
    try {
      const acceptedInvoice = await this.paymentApi.acceptInvoice(invoice, allocation, amount);
      this.events.emit("invoiceAccepted", {
        invoice: acceptedInvoice,
      });
      this.logger.info("Accepted invoice", {
        id: invoice.id,
        allocationId: allocation.id,
        agreementId: invoice.agreementId,
        provider: invoice.provider,
        amount,
      });
      return acceptedInvoice;
    } catch (error) {
      this.events.emit("errorAcceptingInvoice", { invoice, error });
      this.logger.error(`Failed to accept invoice. ${error}`, {
        id: invoice.id,
        allocationId: allocation.id,
        agreementId: invoice.agreementId,
        provider: invoice.provider,
        amount,
      });
      throw error;
    }
  }

  async rejectInvoice(invoice: Invoice, reason: string): Promise<Invoice> {
    this.logger.debug("Rejecting invoice", { id: invoice.id, reason });
    try {
      const rejectedInvoice = await this.paymentApi.rejectInvoice(invoice, reason);
      this.events.emit("invoiceRejected", {
        invoice: rejectedInvoice,
      });
      this.logger.warn("Rejeced invoice", { id: invoice.id, reason });
      return rejectedInvoice;
    } catch (error) {
      this.events.emit("errorRejectingInvoice", { invoice, error });
      this.logger.error(`Failed to reject invoice. ${error}`, { id: invoice.id, reason });
      throw error;
    }
  }

  async acceptDebitNote(debitNote: DebitNote, allocation: Allocation, amount: string): Promise<DebitNote> {
    this.logger.debug("Accepting debit note", debitNote);
    try {
      const acceptedDebitNote = await this.paymentApi.acceptDebitNote(debitNote, allocation, amount);
      this.events.emit("debitNoteAccepted", {
        debitNote: acceptedDebitNote,
      });
      this.logger.debug("Accepted debit note", {
        id: debitNote.id,
        allocationId: allocation.id,
        activityId: debitNote.activityId,
        provider: debitNote.provider,
        amount,
      });
      return acceptedDebitNote;
    } catch (error) {
      this.events.emit("errorAcceptingDebitNote", { debitNote, error });
      this.logger.error(`Failed to accept debitNote. ${error}`, {
        id: debitNote.id,
        allocationId: allocation.id,
        activityId: debitNote.activityId,
        provider: debitNote.provider,
        amount,
      });
      throw error;
    }
  }

  async rejectDebitNote(debitNote: DebitNote, reason: string): Promise<DebitNote> {
    this.logger.info("Rejecting debit note", { id: debitNote.id, reason });
    // TODO: this is not supported by PaymnetAdapter
    const message = "Unable to send debitNote rejection to provider. This feature is not yet supported.";
    this.logger.warn(message);
    this.events.emit("errorRejectingDebitNote", { debitNote, error: new GolemInternalError(message) });
    return debitNote;
    // this.logger.debug("Rejecting debit note", { id: debitNote.id, reason });
    // try {
    //   const rejectedDebitNote = await this.paymentApi.rejectDebitNote(debitNote, reason);
    //   this.events.emit("debitNoteRejected", rejectedDebitNote);
    //   return rejectedDebitNote;
    // } catch (error) {
    //   this.events.emit("errorRejectingDebitNote", debitNote, error);
    //   throw error;
    // }
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
