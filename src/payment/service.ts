import { Logger, sleep } from "../utils";
import { Allocation } from "./allocation";
import { BasePaymentOptions, PaymentConfig } from "./config";
import { Invoice, InvoiceDTO } from "./invoice";
import { DebitNote, DebitNoteDTO } from "./debit_note";
import { Accounts } from "./accounts";
import { Payments, PaymentEventType, DebitNoteEvent, InvoiceEvent } from "./payments";
import { RejectionReason } from "./rejection";

export interface PaymentOptions extends BasePaymentOptions {
  /** Interval for checking new invoices */
  invoiceFetchingInterval?: number;
  /** Interval for checking new debit notes */
  debitNotesFetchingInterval?: number;
  /** Interval for processing payments */
  payingInterval?: number;
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
  public readonly options: PaymentConfig;
  private logger?: Logger;
  private allocations: Allocation[] = [];
  private agreementsToPay: Map<string, AgreementPayable> = new Map();
  private agreementsDebitNotes: Set<string> = new Set();
  private paidAgreements: Set<{ agreement: AgreementPayable; invoice: Invoice }> = new Set();
  private paidDebitNotes: Set<string> = new Set();
  private payments?: Payments;

  constructor(options?: PaymentOptions) {
    this.options = new PaymentConfig(options);
    this.logger = this.options.logger;
  }
  async run() {
    this.isRunning = true;
    this.payments = await Payments.create(this.options);
    this.payments.addEventListener(PaymentEventType, this.subscribePayments.bind(this));
    this.logger?.debug("Payment Service has started");
  }

  async end() {
    if (this.agreementsToPay.size) {
      this.logger?.info(`Waiting for all invoices to be paid. Unpaid agreements: ${this.agreementsToPay.size}`);
      let timeout = false;
      const timeoutId = setTimeout(() => (timeout = true), this.options.paymentTimeout);
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
    this.payments?.unsubscribe().catch((error) => this.logger?.warn(error));
    this.payments?.removeEventListener(PaymentEventType, this.subscribePayments.bind(this));
    for (const allocation of this.allocations) await allocation.release().catch((error) => this.logger?.warn(error));
    this.options.httpAgent.destroy?.();
    this.logger?.info("All allocations has been released");
    this.logger?.debug("Payment service has been stopped");
  }

  async createAllocations(): Promise<Allocation[]> {
    const accounts = await (await Accounts.create(this.options)).list().catch((e) => {
      throw new Error(`Unable to get requestor accounts ${e.response?.data?.message || e.response?.data || e}`);
    });
    for (const account of accounts) {
      if (
        account.driver !== this.options.payment.driver.toLowerCase() ||
        account.network !== this.options.payment.network.toLowerCase()
      ) {
        this.logger?.debug(
          `Not using payment platform ${account.platform}, platform's driver/network ` +
            `${account.driver}/${account.network} is different than requested ` +
            `driver/network ${this.options.payment.driver}/${this.options.payment.network}`,
        );
        continue;
      }
      this.allocations.push(await Allocation.create({ ...this.options.options, account }));
    }
    if (!this.allocations.length) {
      throw new Error(
        `Unable to create allocation for driver/network ${this.options.payment.driver}/${this.options.payment.network}. There is no requestor account supporting this platform.`,
      );
    }
    return this.allocations;
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
      if (await this.options.invoiceFilter(invoice.dto)) {
        const allocation = this.getAllocationForPayment(invoice);
        await invoice.accept(invoice.amount, allocation.id);
        this.paidAgreements.add({ invoice, agreement });
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
      this.agreementsDebitNotes.delete(invoice.agreementId);
      this.agreementsToPay.delete(invoice.agreementId);
    } catch (error) {
      this.logger?.error(`Invoice failed from provider ${invoice.providerId}. ${error}`);
    }
  }

  private async processDebitNote(debitNote: DebitNote) {
    try {
      if (this.paidDebitNotes.has(debitNote.id)) return;
      if (await this.options.debitNoteFilter(debitNote.dto)) {
        const allocation = this.getAllocationForPayment(debitNote);
        await debitNote.accept(debitNote.totalAmountDue, allocation.id);
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

  private getAllocationForPayment(paymentNote: Invoice | DebitNote): Allocation {
    const allocation = this.allocations.find(
      (allocation) =>
        allocation.paymentPlatform === paymentNote.paymentPlatform && allocation.address === paymentNote.payerAddr,
    );
    if (!allocation) throw new Error(`No allocation for ${paymentNote.paymentPlatform} ${paymentNote.payerAddr}`);
    return allocation;
  }
}
