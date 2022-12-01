import { Logger, sleep } from "../utils";
import { Allocation, AllocationOptions } from "./allocation";
import { PaymentConfig } from "./config";
import { Invoice } from "./invoice";
import { DebitNote } from "./debit_note";

export interface PaymentOptions extends AllocationOptions {
  invoiceFetchingInterval?: number;
  debitNotesFetchingInterval?: number;
  maxInvoiceEvents?: number;
  maxDebitNotesEvents?: number;
}

export class PaymentService {
  private isRunning = false;
  private options: PaymentConfig;
  private logger?: Logger;
  private allocations: Allocation[] = [];
  private agreements: Set<string> = new Set();
  private invoices: Map<string, Invoice> = new Map();
  private debitNotes: Map<string, DebitNote> = new Map();
  private lastInvoiceFetchingTime: string = new Date().toISOString();
  private lastDebitNotesFetchingTime: string = new Date().toISOString();

  constructor(options?: PaymentOptions) {
    this.options = new PaymentConfig(options);
    this.logger = this.options.logger;
  }
  async run() {
    this.isRunning = true;
    this.subscribeForInvoices().catch((e) =>
      this.logger?.error(`Could not collect invoices. ${e?.response?.data?.message || e}`)
    );
    this.subscribeForDebitNotes().catch((e) =>
      this.logger?.error(`Could not collect debit notes. ${e?.response?.data?.message || e}`)
    );
    this.processInvoices().catch((error) => this.logger?.error(error));
    this.processDebitNotes().catch((error) => this.logger?.error(error));
    this.logger?.debug("Payment Service has started");
  }

  async end() {
    this.isRunning = false;
    for (const allocation of this.allocations) await allocation.release();
    this.logger?.debug("All allocations has benn released");
    // TODO: waiting for process oll invoices
    this.logger?.debug("Payment service has been stopped");
  }

  async createAllocations(): Promise<Allocation[]> {
    const { data: accounts } = await this.options.api.getRequestorAccounts().catch((e) => {
      throw new Error("Requestor accounts cannot be retrieved. " + e.response?.data?.message || e.response?.data || e);
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
      this.logger?.debug(`Creating allocation using payment platform ${account.platform}`);
      this.allocations.push(await Allocation.create({ ...this.options.options, account }));
    }
    return this.allocations;
  }

  acceptPayments(agreementId: string) {
    this.agreements.add(agreementId);
  }

  private async processInvoices() {
    while (this.isRunning) {
      // TODO
    }
  }

  private async processDebitNotes() {
    while (this.isRunning) {
      // TODO
    }
  }

  private async subscribeForInvoices() {
    while (this.isRunning) {
      const { data: invoiceEvents } = await this.options.api.getInvoiceEvents(
        this.options.timeout,
        this.lastInvoiceFetchingTime,
        this.options.maxInvoiceEvents
      );
      for (const event of invoiceEvents) {
        if (event.eventType !== "InvoiceReceivedEvent") continue;
        const invoice = await Invoice.create(event["invoiceId"], { ...this.options.options });
        this.invoices.set(invoice.id, invoice);
        this.lastInvoiceFetchingTime = event.eventDate;
      }
      await sleep(this.options.invoiceFetchingInterval, true);
    }
  }

  private async subscribeForDebitNotes() {
    while (this.isRunning) {
      const { data: debitNotesEvents } = await this.options.api.getDebitNoteEvents(
        this.options.timeout,
        this.lastDebitNotesFetchingTime,
        this.options.maxDebitNotesEvents
      );
      for (const event of debitNotesEvents) {
        if (event.eventType !== "DebitNoteReceivedEvent") continue;
        const debitNote = await DebitNote.create(event["invoiceId"], { ...this.options.options });
        this.debitNotes.set(debitNote.id, debitNote);
        this.lastDebitNotesFetchingTime = event.eventDate;
      }
      await sleep(this.options.debitNotesFetchingInterval, true);
    }
  }
}
