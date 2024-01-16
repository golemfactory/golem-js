import { Logger, sleep, YagnaApi } from "../utils";
import { Allocation, AllocationOptions } from "./allocation";
import { BasePaymentOptions, PaymentConfig } from "./config";
import { Invoice, InvoiceDTO } from "./invoice";
import { DebitNote, DebitNoteDTO } from "./debit_note";
import { DebitNoteEvent, InvoiceEvent, PAYMENT_EVENT_TYPE, Payments } from "./payments";
import { Agreement } from "../agreement";
import { AgreementPaymentProcess } from "./agreement_payment_process";
import { GolemPaymentError } from "./error";

export interface PaymentOptions extends BasePaymentOptions {
  /** Interval for checking new invoices */
  invoiceFetchingInterval?: number;
  /** Interval for checking new debit notes */
  debitNotesFetchingInterval?: number;
  /** Maximum number of invoice events per one fetching */
  maxInvoiceEvents?: number;
  /** Maximum number of debit notes events per one fetching */
  maxDebitNotesEvents?: number;
  /** A custom filter that checks every debit notes coming from providers */
  debitNotesFilter?: DebitNoteFilter;
  /** A custom filter that checks every invoices coming from providers */
  invoiceFilter?: InvoiceFilter;
}

export type DebitNoteFilter = (debitNote: DebitNoteDTO) => Promise<boolean> | boolean;
export type InvoiceFilter = (invoice: InvoiceDTO) => Promise<boolean> | boolean;

/**
 * Payment Service
 * @description Service used in {@link TaskExecutor}
 * @internal
 */
export class PaymentService {
  public readonly config: PaymentConfig;
  private isRunning = false;
  private logger?: Logger;
  private allocation?: Allocation;
  private processes: Map<string, AgreementPaymentProcess> = new Map();
  private payments?: Payments;

  constructor(
    private readonly yagnaApi: YagnaApi,
    options?: PaymentOptions,
  ) {
    this.config = new PaymentConfig(options);
    this.logger = this.config.logger;
  }

  async run() {
    this.isRunning = true;
    this.payments = await Payments.create(this.yagnaApi, this.config.options);
    this.payments.addEventListener(PAYMENT_EVENT_TYPE, this.subscribePayments.bind(this));
    this.logger?.debug("Payment Service has started");
  }

  async end() {
    if (this.processes.size) {
      this.logger?.info(
        `Waiting for all agreement processes to be completed. Number of processes: ${this.processes.size}`,
      );

      let timeout = false;
      const timeoutId = setTimeout(() => (timeout = true), this.config.paymentTimeout);
      let i = 0;
      while (this.isRunning && !timeout) {
        const numberOfUnpaidAgreements = this.getNumberOfUnpaidAgreements();
        this.isRunning = numberOfUnpaidAgreements !== 0;
        await sleep(2);
        i++;
        if (i > 10) {
          this.logger?.info(`Waiting for ${this.processes.size} agreement processes to be completed to be paid...`);
          i = 0;
        }
      }
      clearTimeout(timeoutId);
    }
    this.isRunning = false;
    await this.payments?.unsubscribe().catch((error) => this.logger?.warn(error));
    this.payments?.removeEventListener(PAYMENT_EVENT_TYPE, this.subscribePayments.bind(this));
    await this.allocation?.release().catch((error) => this.logger?.warn(error));
    this.logger?.info("Allocation has been released");
    this.logger?.debug("Payment service has been stopped");
  }

  /**
   * Create a new allocation that will be used to settle payments for activities
   *
   * @param options Additional options to apply on top of the ones provided in the constructor
   */
  async createAllocation(options?: Partial<AllocationOptions>): Promise<Allocation> {
    try {
      const account = {
        platform: this.getPaymentPlatform(),
        address: await this.getPaymentAddress(),
      };
      this.allocation = await Allocation.create(this.yagnaApi, { ...this.config.options, account, ...options });
      return this.allocation;
    } catch (error) {
      throw new GolemPaymentError(
        `Unable to create allocation for driver/network ${this.config.payment.driver}/${this.config.payment.network}. ${error}`,
      );
    }
  }

  acceptPayments(agreement: Agreement) {
    this.logger?.debug(`Starting to accept payments for agreement ${agreement.id}`);

    if (this.processes.has(agreement.id)) {
      this.logger?.warn("Payment process has already been started for this agreement");
      return;
    }

    if (!this.allocation) {
      throw new GolemPaymentError("You need to create an allocation before starting any payment processes");
    }

    this.processes.set(
      agreement.id,
      new AgreementPaymentProcess(
        agreement,
        this.allocation,
        {
          invoiceFilter: this.config.invoiceFilter,
          debitNoteFilter: this.config.debitNoteFilter,
        },
        this.logger,
      ),
    );
  }

  /**
   * @deprecated, Use `acceptPayments` instead
   */
  // Reason: We will remove this in 2.0
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  acceptDebitNotes(_agreementId: string) {
    this.logger?.warn(
      "PaymentService.acceptDebitNotes is deprecated and will be removed in the next major version. " +
        "Use PaymentService.acceptPayments which now also deal with debit notes.",
    );
    return;
  }

  private getNumberOfUnpaidAgreements() {
    const inProgress = [...this.processes.values()].filter((p) => !p.isFinished());

    return inProgress.length;
  }

  private async processInvoice(invoice: Invoice) {
    this.logger?.debug(`Attempting to process Invoice event: ID=${invoice.id} Agreement ID=${invoice.agreementId}`);
    const process = this.processes.get(invoice.agreementId);

    // This serves two purposes:
    // 1. We will only process invoices which have a payment process started
    // 2. Indirectly, we reject invoices from agreements that we didn't create (TODO: guard this business rule elsewhere)
    if (!process) {
      throw new GolemPaymentError(
        "No payment process was initiated for this agreement - did you forget to use 'acceptPayments' or that's not your invoice?",
      );
    }

    await process.addInvoice(invoice);
  }

  private async processDebitNote(debitNote: DebitNote) {
    this.logger?.debug(
      `Attempting to process DebitNote event - ID=${debitNote.id}, Agreement ID=${debitNote.agreementId}`,
    );
    const process = this.processes.get(debitNote.agreementId);

    // This serves two purposes:
    // 1. We will only process debit-notes which have a payment process started
    // 2. Indirectly, we reject debit-notes from agreements that we didn't create (TODO: guard this business rule elsewhere)
    if (!process) {
      throw new GolemPaymentError(
        "No payment process was initiated for this agreement - did you forget to use 'acceptPayments' or that's not your debit note?",
      );
    }

    await process.addDebitNote(debitNote);
  }

  private async subscribePayments(event: Event) {
    if (event instanceof InvoiceEvent) {
      this.processInvoice(event.invoice)
        .then(() => this.logger?.debug(`Invoice event processed for agreement ${event.invoice.agreementId}`))
        .catch(
          (err) =>
            this.logger?.error(`Failed to process InvoiceEvent for agreement ${event.invoice.agreementId}: ${err}`),
        );
    }

    if (event instanceof DebitNoteEvent) {
      this.processDebitNote(event.debitNote)
        .then(() => this.logger?.debug(`DebitNote event processed for agreement ${event.debitNote.agreementId}`))
        .catch(
          (err) =>
            this.logger?.error(`Failed to process DebitNoteEvent for agreement ${event.debitNote.agreementId}: ${err}`),
        );
    }
  }

  private getPaymentPlatform() {
    const mainnets = ["polygon", "mainnet"];
    const token = mainnets.includes(this.config.payment.network) ? "glm" : "tglm";

    return `${this.config.payment.driver}-${this.config.payment.network}-${token}`;
  }

  private async getPaymentAddress(): Promise<string> {
    const data = await this.yagnaApi.identity.getIdentity();
    return data.identity;
  }
}
