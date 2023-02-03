import { Logger, sleep } from "../utils";
import { Allocation } from "./allocation";
import { BasePaymentOptions, PaymentConfig } from "./config";
import { Invoice } from "./invoice";
import { DebitNote } from "./debit_note";
import { Events } from "../events";
import { Accounts } from "./accounts";

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
  private invoicesToPay: Map<string, Invoice> = new Map();
  private debitNotesToPay: Map<string, DebitNote> = new Map();
  private paidAgreements: Set<{ agreement: AgreementPayable; invoice: Invoice }> = new Set();
  private lastInvoiceFetchingTime: string = new Date().toISOString();
  private lastDebitNotesFetchingTime: string = new Date().toISOString();

  constructor(options?: PaymentOptions) {
    this.options = new PaymentConfig(options);
    this.logger = this.options.logger;
  }
  async run() {
    this.isRunning = true;
    this.subscribeForInvoices().catch((e) =>
      this.logger?.error(`Unable to collect invoices. ${e?.response?.data?.message || e}`)
    );
    this.subscribeForDebitNotes().catch((e) =>
      this.logger?.error(`Unable to collect debit notes. ${e?.response?.data?.message || e}`)
    );
    this.processInvoices().catch((error) => this.logger?.error(error));
    this.processDebitNotes().catch((error) => this.logger?.error(error));
    this.logger?.debug("Payment Service has started");
  }

  async end() {
    if (this.agreementsToPay.size) {
      this.logger?.debug("Waiting for all invoices to be paid...");
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

  private async processInvoices() {
    while (this.isRunning) {
      for (const invoice of this.invoicesToPay.values()) {
        const agreement = this.agreementsToPay.get(invoice.agreementId);
        if (!agreement) {
          this.invoicesToPay.delete(invoice.id);
          this.logger?.warn(`Agreement ${invoice.agreementId} has not been accepted to payment`);
          continue;
        }
        try {
          const allocation = this.getAllocationForPayment(invoice);
          await invoice.accept(invoice.amount, allocation.id);
          this.invoicesToPay.delete(invoice.id);
          this.paidAgreements.add({ invoice, agreement });
          this.agreementsDebitNotes.delete(invoice.agreementId);
          this.agreementsToPay.delete(invoice.agreementId);
          this.logger?.info(`Invoice accepted from ${agreement.provider.name}`);
        } catch (error) {
          this.logger?.error(`Invoice failed from ${agreement.provider.name}. ${error}`);
        }
      }
      await sleep(this.options.payingInterval, true);
    }
  }

  private async processDebitNotes() {
    while (this.isRunning) {
      for (const debitNote of this.debitNotesToPay.values()) {
        if (!this.agreementsDebitNotes.has(debitNote.agreementId)) continue;
        try {
          const allocation = this.getAllocationForPayment(debitNote);
          await debitNote.accept(debitNote.totalAmountDue, allocation.id);
          this.debitNotesToPay.delete(debitNote.id);
          this.logger?.debug(`Debit Note accepted for agreement ${debitNote.agreementId}`);
        } catch (error) {
          this.logger?.error(`Payment Debit Note failed for agreement ${debitNote.agreementId} ${error}`);
        }
      }
      await sleep(this.options.payingInterval, true);
    }
  }

  private async subscribeForInvoices() {
    while (this.isRunning) {
      const { data: invoiceEvents } = await this.options.api
        .getInvoiceEvents(
          this.options.paymentRequestTimeout / 1000,
          this.lastInvoiceFetchingTime,
          this.options.maxInvoiceEvents
        )
        .catch((e) => this.logger?.error(`Unable to collect invoices. ${e?.response?.data?.message || e}`));
      for (const event of invoiceEvents) {
        if (event.eventType !== "InvoiceReceivedEvent") continue;
        const invoice = await Invoice.create(event["invoiceId"], { ...this.options.options }).catch((e) =>
          this.logger?.error(`Unable to create invoice ID: ${event["invoiceId"]}. ${e?.response?.data?.message || e}`)
        );
        this.invoicesToPay.set(invoice.id, invoice);
        this.lastInvoiceFetchingTime = event.eventDate;
        this.options.eventTarget?.dispatchEvent(new Events.InvoiceReceived(invoice));
        this.logger?.debug(`New Invoice received for agreement ${invoice.agreementId}`);
      }
      await sleep(this.options.invoiceFetchingInterval, true);
    }
  }

  private async subscribeForDebitNotes() {
    while (this.isRunning) {
      const { data: debitNotesEvents } = await this.options.api
        .getDebitNoteEvents(
          this.options.paymentRequestTimeout / 1000,
          this.lastDebitNotesFetchingTime,
          this.options.maxDebitNotesEvents
        )
        .catch((e) => this.logger?.error(`Unable to collect debit notes. ${e?.response?.data?.message || e}`));
      for (const event of debitNotesEvents) {
        if (event.eventType !== "DebitNoteReceivedEvent") continue;
        const debitNote = await DebitNote.create(event["debitNoteId"], { ...this.options.options }).catch((e) =>
          this.logger?.error(
            `Unable to create debit note ID: ${event["debitNoteId"]}. ${e?.response?.data?.message || e}`
          )
        );
        this.debitNotesToPay.set(debitNote.id, debitNote);
        this.lastDebitNotesFetchingTime = event.eventDate;
        this.options.eventTarget?.dispatchEvent(
          new Events.DebitNoteReceived({
            id: debitNote.id,
            agreementId: debitNote.agreementId,
            amount: debitNote.totalAmountDue,
          })
        );
        this.logger?.debug(`New Debit Note received for agreement ${debitNote.agreementId}`);
      }
      await sleep(this.options.debitNotesFetchingInterval, true);
    }
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
