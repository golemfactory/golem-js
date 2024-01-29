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

export const PAYMENT_EVENT_TYPE = "PaymentReceived";
const UNSUBSCRIBED_EVENT = "Unsubscribed";

export class Payments extends EventTarget {
  private isRunning = true;
  private options: PaymentConfig;
  private logger: Logger;
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
    this.subscribe().catch((error) => this.logger.error(`Unable to subscribe to payments`, { error }));
  }

  /**
   * Unsubscribe from collecting payment events.
   * An error will be thrown when the unsubscribe timeout expires.
   */
  async unsubscribe() {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(
        () =>
          reject(
            `The waiting time (${this.options.unsubscribeTimeoutInMs} ms) for unsubscribe payment has been exceeded.`,
          ),
        this.options.unsubscribeTimeoutInMs,
      );
      this.addEventListener(UNSUBSCRIBED_EVENT, () => {
        this.logger.debug(`Payments unsubscribed`);
        clearTimeout(timeoutId);
        resolve(true);
      });
      this.isRunning = false;
    });
  }

  private async subscribe() {
    this.subscribeForInvoices().catch((error) => this.logger.error(`Unable to collect invoices.`, { error }));
    this.subscribeForDebitNotes().catch((error) => this.logger.error(`Unable to collect debit notes.`, { error }));
  }

  private async subscribeForInvoices() {
    while (this.isRunning) {
      try {
        const { data: invoiceEvents } = await this.yagnaApi.payment.getInvoiceEvents(
          this.options.invoiceFetchingInterval / 1000,
          this.lastInvoiceFetchingTime,
          this.options.maxInvoiceEvents,
          this.yagnaApi.appSessionId,
          { timeout: 0 },
        );
        for (const event of invoiceEvents) {
          if (!this.isRunning) break;
          if (event.eventType !== "InvoiceReceivedEvent") continue;
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore FIXME: ya-ts-client does not provide invoiceId in the event even though it is in the API response
          const invoiceId = event["invoiceId"];
          const invoice = await Invoice.create(invoiceId, this.yagnaApi, { ...this.options }).catch((error) =>
            this.logger.error(`Unable to create invoice`, { id: invoiceId, error }),
          );
          if (!invoice) continue;
          this.dispatchEvent(new InvoiceEvent(PAYMENT_EVENT_TYPE, invoice));
          this.lastInvoiceFetchingTime = event.eventDate;
          this.options.eventTarget?.dispatchEvent(
            new Events.InvoiceReceived({
              id: invoice.id,
              agreementId: invoice.agreementId,
              amount: invoice.amount,
              provider: invoice.provider,
            }),
          );
          this.logger.debug(`New Invoice received`, {
            id: invoice.id,
            agreementId: invoice.agreementId,
            amount: invoice.amount,
          });
        }
      } catch (error) {
        const reason = error.response?.data?.message || error.message || error;
        this.logger.error(`Unable to get invoices.`, { reason });
        await sleep(2);
      }
    }
    this.dispatchEvent(new Event(UNSUBSCRIBED_EVENT));
  }

  private async subscribeForDebitNotes() {
    while (this.isRunning) {
      try {
        const { data: debitNotesEvents } = await this.yagnaApi.payment
          .getDebitNoteEvents(
            this.options.debitNotesFetchingInterval / 1000,
            this.lastDebitNotesFetchingTime,
            this.options.maxDebitNotesEvents,
            this.yagnaApi.appSessionId,
            { timeout: 0 },
          )
          .catch(() => ({ data: [] }));

        for (const event of debitNotesEvents) {
          if (!this.isRunning) return;
          if (event.eventType !== "DebitNoteReceivedEvent") continue;
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore FIXME: ya-ts-client does not provide debitNoteId in the event even though it is in the API response
          const debitNoteId = event["debitNoteId"];
          const debitNote = await DebitNote.create(debitNoteId, this.yagnaApi, { ...this.options }).catch((error) =>
            this.logger.error(`Unable to create debit note`, { id: debitNoteId, error }),
          );
          if (!debitNote) continue;
          this.dispatchEvent(new DebitNoteEvent(PAYMENT_EVENT_TYPE, debitNote));
          this.lastDebitNotesFetchingTime = event.eventDate;
          this.options.eventTarget?.dispatchEvent(
            new Events.DebitNoteReceived({
              id: debitNote.id,
              agreementId: debitNote.agreementId,
              activityId: debitNote.activityId,
              amount: debitNote.totalAmountDue,
              provider: debitNote.provider,
            }),
          );
          this.logger.debug("New Debit Note received", {
            agreementId: debitNote.agreementId,
            amount: debitNote.totalAmountDue,
          });
        }
      } catch (error) {
        const reason = error.response?.data?.message || error;
        this.logger.error(`Unable to get debit notes.`, { reason });
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
  constructor(type: string, data: EventInit & Invoice) {
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
  constructor(type: string, data: EventInit & DebitNote) {
    super(type, data);
    this.debitNote = data;
  }
}
