import { IPaymentApi } from "../../../agreement";
import { BehaviorSubject, from, switchMap } from "rxjs";
import { Allocation, DebitNote, Invoice } from "../../../payment";
import { IInvoiceRepository } from "../../../payment/invoice";
import { CancellablePoll, EventReaderFactory } from "../event-reader-factory";
import { Logger, YagnaApi } from "../../utils";
import { YagnaDebitNoteEvent, YagnaInvoiceEvent } from "../yagnaApi";
import { IDebitNoteRepository } from "../../../payment/debit_note";

export class PaymentApiAdapter implements IPaymentApi {
  public receivedInvoices$ = new BehaviorSubject<Invoice | null>(null);
  private invoiceReader: CancellablePoll<YagnaInvoiceEvent> | null = null;

  public receivedDebitNotes$ = new BehaviorSubject<DebitNote | null>(null);
  private debitNoteReader: CancellablePoll<YagnaDebitNoteEvent> | null = null;

  private reader = new EventReaderFactory(this.logger);

  constructor(
    private readonly yagna: YagnaApi,
    private readonly invoiceRepo: IInvoiceRepository,
    private readonly debitNoteRepo: IDebitNoteRepository,
    private readonly logger: Logger,
  ) {}

  async connect() {
    this.logger.info("Connecting Payment API Adapter");

    const pollIntervalSec = 5;
    const maxEvents = 100;

    this.invoiceReader = this.reader.createEventReader("InvoiceEvents", (lastEventTimestamp) =>
      this.yagna.payment.getInvoiceEvents(pollIntervalSec, lastEventTimestamp, maxEvents, this.yagna.appSessionId),
    );

    from(this.invoiceReader.pollValues())
      .pipe(
        switchMap((invoice) => {
          if (invoice.invoiceId) {
            return this.invoiceRepo.getById(invoice.invoiceId);
          } else {
            return Promise.resolve(null);
          }
        }),
      )
      .subscribe({
        next: (event) => this.receivedInvoices$.next(event),
        error: (err) => this.receivedInvoices$.error(err),
        complete: () => this.logger.debug("Finished reading InvoiceEvents"),
      });

    this.debitNoteReader = this.reader.createEventReader("DebitNoteEvents", (lastEventTimestamp) =>
      this.yagna.payment.getDebitNoteEvents(pollIntervalSec, lastEventTimestamp, maxEvents, this.yagna.appSessionId),
    );

    from(this.debitNoteReader.pollValues())
      .pipe(
        switchMap((debitNote) => {
          if (debitNote.debitNoteId) {
            return this.debitNoteRepo.getById(debitNote.debitNoteId);
          } else {
            return Promise.resolve(null);
          }
        }),
      )
      .subscribe({
        next: (event) => this.receivedDebitNotes$.next(event),
        error: (err) => this.receivedDebitNotes$.error(err),
        complete: () => this.logger.debug("Finished reading DebitNoteEvents"),
      });

    this.logger.info("Payment API Adapter connected");
  }

  getInvoice(id: string): Promise<Invoice> {
    return this.invoiceRepo.getById(id);
  }

  getDebitNote(id: string): Promise<DebitNote> {
    return this.debitNoteRepo.getById(id);
  }

  async disconnect() {
    this.logger.info("Disconnecting Payment API Adapter");
    await this.invoiceReader?.cancel();
    await this.debitNoteReader?.cancel();
    this.logger.info("Payment API Adapter disconnected");
  }

  async acceptInvoice(invoice: Invoice, allocation: Allocation, amount: string): Promise<Invoice> {
    await this.yagna.payment.acceptInvoice(invoice.id, {
      totalAmountAccepted: amount,
      allocationId: allocation.id,
    });

    return this.invoiceRepo.getById(invoice.id);
  }

  async rejectInvoice(invoice: Invoice, reason: string): Promise<Invoice> {
    await this.yagna.payment.rejectInvoice(invoice.id, {
      rejectionReason: "BAD_SERVICE",
      totalAmountAccepted: "0.00",
      message: reason,
    });

    return this.invoiceRepo.getById(invoice.id);
  }

  async acceptDebitNote(debitNote: DebitNote, allocation: Allocation, amount: string): Promise<DebitNote> {
    await this.yagna.payment.acceptDebitNote(debitNote.id, {
      totalAmountAccepted: amount,
      allocationId: allocation.id,
    });

    return this.debitNoteRepo.getById(debitNote.id);
  }

  async rejectDebitNote(debitNote: DebitNote, reason: string): Promise<DebitNote> {
    await this.yagna.payment.rejectDebitNote(debitNote.id, {
      rejectionReason: "BAD_SERVICE",
      totalAmountAccepted: "0.00",
      message: reason,
    });

    return this.debitNoteRepo.getById(debitNote.id);
  }
}
