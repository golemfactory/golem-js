import { BasePaymentOptions, PaymentConfig } from "./config";
import { Logger, sleep, YagnaApi } from "../utils";
import { Invoice } from "./invoice";
import { DebitNote } from "./debit_note";
import { Events } from "../events";

export interface PaymentOptions extends BasePaymentOptions {
  invoiceFetchingInterval?: number;
  debitNotesFetchingInterval?: number;
  maxInvoiceEvents?: number;
  maxDebitNotesEvents?: number;
}

export const PaymentEventType = "PaymentReceived";

export class Payments extends EventTarget {
  private isRunning = true;
  private options: PaymentConfig;
  private logger?: Logger;
  private lastInvoiceFetchingTime: string = new Date().toISOString();
  private lastDebitNotesFetchingTime: string = new Date().toISOString();
  static async create(yagnaApi: YagnaApi, options?: PaymentOptions) {
    return new Payments(yagnaApi, new PaymentConfig(options));
  }

  constructor(
    private readonly yagnaApi: YagnaApi,
    options?: PaymentOptions,
  ) {
    super();
    this.options = new PaymentConfig(options);
    this.logger = this.options.logger;
    this.subscribe().catch((e) => this.logger?.error(e));
  }

  /**
   * Unsubscribe demand from the market
   */
  async unsubscribe() {
    this.isRunning = false;
    this.logger?.debug(`Payments unsubscribed`);
  }

  private async subscribe() {
    this.subscribeForInvoices().catch(
      (e) => this.logger?.debug(`Unable to collect invoices. ${e?.response?.data?.message || e}`),
    );
    this.subscribeForDebitNotes().catch(
      (e) => this.logger?.debug(`Unable to collect debit notes. ${e?.response?.data?.message || e}`),
    );
  }

  private async subscribeForInvoices() {
    while (this.isRunning) {
      try {
        const { data: invoiceEvents } = await this.yagnaApi.payment.getInvoiceEvents(
          this.options.invoiceFetchingInterval / 1000,
          this.lastInvoiceFetchingTime,
          this.options.maxInvoiceEvents,
          undefined,
          { timeout: 0 },
        );
        for (const event of invoiceEvents) {
          if (!this.isRunning) return;
          if (event.eventType !== "InvoiceReceivedEvent") continue;
          const invoice = await Invoice.create(event["invoiceId"], this.yagnaApi, { ...this.options }).catch(
            (e) =>
              this.logger?.error(
                `Unable to create invoice ID: ${event["invoiceId"]}. ${e?.response?.data?.message || e}`,
              ),
          );
          if (!invoice) continue;
          this.dispatchEvent(new InvoiceEvent(PaymentEventType, invoice));
          this.lastInvoiceFetchingTime = event.eventDate;
          this.options.eventTarget?.dispatchEvent(new Events.InvoiceReceived(invoice));
          this.logger?.debug(`New Invoice received for agreement ${invoice.agreementId}. Amount: ${invoice.amount}`);
        }
      } catch (error) {
        const reason = error.response?.data?.message || error;
        this.logger?.debug(`Unable to get invoices. ${reason}`);
        await sleep(2);
      }
    }
  }

  private async subscribeForDebitNotes() {
    while (this.isRunning) {
      try {
        const { data: debitNotesEvents } = await this.yagnaApi.payment
          .getDebitNoteEvents(
            this.options.debitNotesFetchingInterval / 1000,
            this.lastDebitNotesFetchingTime,
            this.options.maxDebitNotesEvents,
            undefined,
            { timeout: 0 },
          )
          .catch(() => ({ data: [] }));

        for (const event of debitNotesEvents) {
          if (!this.isRunning) return;
          if (event.eventType !== "DebitNoteReceivedEvent") continue;
          const debitNote = await DebitNote.create(event["debitNoteId"], this.yagnaApi, { ...this.options }).catch(
            (e) =>
              this.logger?.error(
                `Unable to create debit note ID: ${event["debitNoteId"]}. ${e?.response?.data?.message || e}`,
              ),
          );
          if (!debitNote) continue;
          this.dispatchEvent(new DebitNoteEvent(PaymentEventType, debitNote));
          this.lastDebitNotesFetchingTime = event.eventDate;
          this.options.eventTarget?.dispatchEvent(
            new Events.DebitNoteReceived({
              id: debitNote.id,
              agreementId: debitNote.agreementId,
              activityId: debitNote.activityId,
              amount: debitNote.totalAmountDue,
            }),
          );
          this.logger?.debug(
            `New Debit Note received for agreement ${debitNote.agreementId}. Amount: ${debitNote.totalAmountDue}`,
          );
        }
      } catch (error) {
        const reason = error.response?.data?.message || error;
        this.logger?.debug(`Unable to get debit notes. ${reason}`);
        await sleep(2);
      }
    }
  }
}

/**
 * @hidden
 */
export class InvoiceEvent extends Event {
  readonly invoice: Invoice;

  /**
   * Create a new instance of DemandEvent
   * @param type A string with the name of the event:
   * @param data object with invoice data:
   */
  constructor(type, data) {
    super(type, data);
    this.invoice = data;
  }
}

/**
 * @hidden
 */
export class DebitNoteEvent extends Event {
  readonly debitNote: DebitNote;

  /**
   * Create a new instance of DemandEvent
   * @param type A string with the name of the event:
   * @param data object with debit note data:
   */
  constructor(type, data) {
    super(type, data);
    this.debitNote = data;
  }
}
