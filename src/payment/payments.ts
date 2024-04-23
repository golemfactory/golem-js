import { BasePaymentOptions, PaymentConfig } from "./config";
import { Logger, YagnaApi } from "../shared/utils";
import { Invoice } from "./invoice";
import { DebitNote } from "./debit_note";
import { GolemTimeoutError } from "../shared/error/golem-error";
import { EventEmitter } from "eventemitter3";
import { Subscription } from "rxjs";
import { IPaymentApi } from "../agreement";
import { PaymentApiAdapter } from "../shared/yagna/adapters/payment-api-adapter";
import { InvoiceRepository } from "../shared/yagna/repository/invoice-repository";
import { DebitNoteRepository } from "../shared/yagna/repository/debit-note-repository";

export interface PaymentEvents {
  invoiceReceived: (invoice: Invoice) => void;
  debitNoteReceived: (debitNote: DebitNote) => void;
  unsubscribed: () => void;
}

export interface PaymentOptions extends BasePaymentOptions {
  invoiceFetchingInterval?: number;
  debitNotesFetchingInterval?: number;
  maxInvoiceEvents?: number;
  maxDebitNotesEvents?: number;
}

export class Payments {
  private options: PaymentConfig;
  private logger: Logger;

  public readonly events = new EventEmitter<PaymentEvents>();

  private debitNoteSubscription: Subscription | null = null;
  private invoiceSubscription: Subscription | null = null;

  private paymentApi: IPaymentApi;

  static async create(yagnaApi: YagnaApi, options?: PaymentOptions) {
    return new Payments(yagnaApi, new PaymentConfig(options));
  }

  constructor(
    private readonly yagnaApi: YagnaApi,
    options?: PaymentOptions,
  ) {
    this.options = new PaymentConfig(options);
    this.logger = this.options.logger;

    this.paymentApi = new PaymentApiAdapter(
      this.yagnaApi,
      new InvoiceRepository(yagnaApi.payment, yagnaApi.market),
      new DebitNoteRepository(yagnaApi.payment, yagnaApi.market),
      this.logger,
    );

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
            new GolemTimeoutError(
              `The waiting time (${this.options.unsubscribeTimeoutMs} ms) for unsubscribe payment has been exceeded.`,
            ),
          ),
        this.options.unsubscribeTimeoutMs,
      );

      this.debitNoteSubscription?.unsubscribe();
      this.invoiceSubscription?.unsubscribe();

      clearTimeout(timeoutId);

      resolve(true);
    });
  }

  private async subscribe() {
    this.subscribeForInvoices();
    this.subscribeForDebitNotes();
  }

  private subscribeForInvoices() {
    this.invoiceSubscription = this.yagnaApi.invoiceEvents$.subscribe(async (event) => {
      this.logger.debug("Received invoice event from Yagna", { event });

      if (event && event.eventType === "InvoiceReceivedEvent") {
        if (event.invoiceId) {
          try {
            const invoice = await this.paymentApi.getInvoice(event.invoiceId);
            this.events.emit("invoiceReceived", invoice);
            this.logger.debug(`New Invoice received`, {
              id: invoice.id,
              agreementId: invoice.agreementId,
              amount: invoice.amount,
            });
          } catch (err) {
            this.logger.error(`Unable to create invoice`, { event, err });
          }
        } else {
          this.logger.warn("Received invoice event without invoice ID", { event });
        }
      }
    });
  }

  private subscribeForDebitNotes() {
    this.debitNoteSubscription = this.yagnaApi.debitNoteEvents$.subscribe(async (event) => {
      this.logger.debug("Received debit note event from Yagna", { event });

      if (event && event.eventType === "DebitNoteReceivedEvent") {
        if (event.debitNoteId) {
          try {
            const debitNote = await this.paymentApi.getDebitNote(event.debitNoteId);
            this.events.emit("debitNoteReceived", debitNote);
            this.logger.debug("New Debit Note received", {
              agreementId: debitNote.agreementId,
              amount: debitNote.totalAmountDue,
            });
          } catch (err) {
            this.logger.error(`Unable to create debit note`, { event, err });
          }
        } else {
          this.logger.warn("Received debit note event without debit note ID", { event });
        }
      }
    });
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
