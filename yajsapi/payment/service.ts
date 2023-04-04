import { Logger, sleep } from "../utils/index.js";
import { Allocation } from "./allocation.js";
import { BasePaymentOptions, PaymentConfig } from "./config.js";
import { Invoice } from "./invoice.js";
import { DebitNote } from "./debit_note.js";
import { Accounts } from "./accounts.js";
import { Payments, PaymentEventType, DebitNoteEvent, InvoiceEvent } from "./payments.js";

/**
 * @internal
 */
export interface PaymentOptions extends BasePaymentOptions {
  invoiceFetchingInterval?: number;
  debitNotesFetchingInterval?: number;
  payingInterval?: number;
  maxInvoiceEvents?: number;
  maxDebitNotesEvents?: number;
}

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
  private options: PaymentConfig;
  private logger?: Logger;
  private allocations: Allocation[] = [];
  private agreementsToPay: Map<string, AgreementPayable> = new Map();
  private agreementsDebitNotes: Set<string> = new Set();
  private paidAgreements: Set<{ agreement: AgreementPayable; invoice: Invoice }> = new Set();
  private paidDebitNotes: Set<string> = new Set();
  private payments?: Payments;

  constructor(options?: PaymentOptions) {
    this.options = new PaymentConfig(options);
    // this.logger = this.options.logger;
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
        await sleep(2000, true);
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
    this.logger?.debug("All allocations has benn released");
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
            `driver/network ${this.options.payment.driver}/${this.options.payment.network}`
        );
        continue;
      }
      this.allocations.push(await Allocation.create({ ...this.options.options, account }));
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
      const allocation = this.getAllocationForPayment(invoice);
      await invoice.accept(invoice.amount, allocation.id);
      this.paidAgreements.add({ invoice, agreement });
      this.agreementsDebitNotes.delete(invoice.agreementId);
      this.agreementsToPay.delete(invoice.agreementId);
      this.logger?.info(`Invoice accepted from provider ${agreement.provider.name}`);
    } catch (error) {
      this.logger?.error(`Invoice failed from provider ${invoice.providerId}. ${error}`);
    }
  }

  private async processDebitNote(debitNote: DebitNote) {
    try {
      if (this.paidDebitNotes.has(debitNote.id)) return;
      const allocation = this.getAllocationForPayment(debitNote);
      await debitNote.accept(debitNote.totalAmountDue, allocation.id);
      this.paidDebitNotes.add(debitNote.id);
      this.logger?.debug(`Debit Note accepted for agreement ${debitNote.agreementId}`);
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
        allocation.paymentPlatform === paymentNote.paymentPlatform && allocation.address === paymentNote.payerAddr
    );
    if (!allocation) throw new Error(`No allocation for ${paymentNote.paymentPlatform} ${paymentNote.payerAddr}`);
    return allocation;
  }
}
