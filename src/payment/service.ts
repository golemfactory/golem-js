import { Logger, sleep, YagnaApi } from "../utils";
import { Allocation, AllocationOptions } from "./allocation";
import { BasePaymentOptions, PaymentConfig } from "./config";
import { Invoice, InvoiceDTO } from "./invoice";
import { DebitNote, DebitNoteDTO } from "./debit_note";
import { Payments, PaymentEventType, DebitNoteEvent, InvoiceEvent } from "./payments";
import { RejectionReason } from "./rejection";

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

export type DebitNoteFilter = (debitNote: DebitNoteDTO) => Promise<boolean>;
export type InvoiceFilter = (invoice: InvoiceDTO) => Promise<boolean>;

interface AgreementPayable {
  id: string;
  provider: { id: string; name: string };
}

/**
 * Payment Service
 * @description Service used in {@link TaskExecutor}
 * @internal
 */
export class PaymentService {
  private isRunning = false;
  public readonly config: PaymentConfig;
  private logger?: Logger;
  private allocation?: Allocation;
  private agreementsToPay: Map<string, AgreementPayable> = new Map();
  private agreementsDebitNotes: Set<string> = new Set();
  private paidDebitNotes: Set<string> = new Set();
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
    this.payments.addEventListener(PaymentEventType, this.subscribePayments.bind(this));
    this.logger?.debug("Payment Service has started");
  }

  async end() {
    if (this.agreementsToPay.size) {
      this.logger?.info(`Waiting for all invoices to be paid. Unpaid agreements: ${this.agreementsToPay.size}`);
      let timeout = false;
      const timeoutId = setTimeout(() => (timeout = true), this.config.paymentTimeout);
      let i = 0;
      while (this.isRunning && !timeout) {
        this.isRunning = this.agreementsToPay.size !== 0;
        await sleep(2);
        i++;
        if (i > 10) {
          this.logger?.info(`Waiting for ${this.agreementsToPay.size} invoice to be paid...`);
          i = 0;
        }
      }
      clearTimeout(timeoutId);
    }
    this.isRunning = false;
    await this.payments?.unsubscribe().catch((error) => this.logger?.warn(error));
    this.payments?.removeEventListener(PaymentEventType, this.subscribePayments.bind(this));
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
      throw new Error(
        `Unable to create allocation for driver/network ${this.config.payment.driver}/${this.config.payment.network}. ${error}`,
      );
    }
  }

  acceptPayments(agreement: AgreementPayable) {
    this.agreementsToPay.set(agreement.id, agreement);
  }

  acceptDebitNotes(agreementId: string) {
    this.agreementsDebitNotes.add(agreementId);
  }

  private async processInvoice(invoice: Invoice) {
    try {
      const agreement = this.agreementsToPay.get(invoice.agreementId);
      if (!agreement) {
        this.logger?.debug(`Agreement ${invoice.agreementId} has not been accepted to payment`);
        return;
      }
      if (await this.config.invoiceFilter(invoice.dto)) {
        await invoice.accept(invoice.amount, this.allocation!.id);
        this.logger?.info(`Invoice accepted from provider ${agreement.provider.name}`);
      } else {
        const reason = {
          rejectionReason: RejectionReason.IncorrectAmount,
          totalAmountAccepted: "0",
          message: "Invoice rejected by Invoice Filter",
        };
        await invoice.reject(reason);
        this.logger?.warn(
          `Invoice has been rejected for provider ${agreement.provider.name}. Reason: ${reason.message}`,
        );
      }
    } catch (error) {
      this.logger?.error(`Invoice failed from provider ${invoice.providerId}. ${error}`);
    } finally {
      // Until we implement a re-acceptance mechanism for unsuccessful acceptances,
      // we no longer have to wait for the invoice during an unsuccessful attempt.
      this.agreementsDebitNotes.delete(invoice.agreementId);
      this.agreementsToPay.delete(invoice.agreementId);
    }
  }

  private async processDebitNote(debitNote: DebitNote) {
    try {
      if (this.paidDebitNotes.has(debitNote.id)) return;
      if (await this.config.debitNoteFilter(debitNote.dto)) {
        await debitNote.accept(debitNote.totalAmountDue, this.allocation!.id);
        this.paidDebitNotes.add(debitNote.id);
        this.logger?.debug(`Debit Note accepted for agreement ${debitNote.agreementId}`);
      } else {
        const reason = {
          rejectionReason: RejectionReason.IncorrectAmount,
          totalAmountAccepted: "0",
          message: "DebitNote rejected by DebitNote Filter",
        };
        await debitNote.reject(reason);
        this.logger?.warn(
          `DebitNote has been rejected for agreement ${debitNote.agreementId}. Reason: ${reason.message}`,
        );
      }
    } catch (error) {
      this.logger?.debug(`Payment Debit Note failed for agreement ${debitNote.agreementId} ${error}`);
    }
  }

  private async subscribePayments(event) {
    if (event instanceof InvoiceEvent) this.processInvoice(event.invoice).then();
    if (event instanceof DebitNoteEvent) this.processDebitNote(event.debitNote).then();
  }

  private getPaymentPlatform(): string {
    const mainnets = ["polygon", "mainnet"];
    const token = mainnets.includes(this.config.payment.network) ? "glm" : "tglm";
    return `${this.config.payment.driver}-${this.config.payment.network}-${token}`;
  }

  private async getPaymentAddress(): Promise<string> {
    const { data } = await this.yagnaApi.identity.getIdentity();
    return data.identity;
  }
}
