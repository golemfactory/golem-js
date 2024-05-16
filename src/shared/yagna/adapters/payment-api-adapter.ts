import { IPaymentApi } from "../../../agreement";
import { Subject, from, mergeMap, of } from "rxjs";
import { Allocation, DebitNote, Invoice } from "../../../payment";
import { IInvoiceRepository } from "../../../payment/invoice";
import { Logger, YagnaApi } from "../../utils";
import { IDebitNoteRepository } from "../../../payment/debit_note";

export class PaymentApiAdapter implements IPaymentApi {
  public receivedInvoices$ = new Subject<Invoice>();

  public receivedDebitNotes$ = new Subject<DebitNote>();

  constructor(
    private readonly yagna: YagnaApi,
    private readonly invoiceRepo: IInvoiceRepository,
    private readonly debitNoteRepo: IDebitNoteRepository,
    private readonly logger: Logger,
  ) {}

  async connect() {
    this.logger.debug("Connecting Payment API Adapter");

    from(this.yagna.invoiceEvents$)
      .pipe(
        mergeMap((invoice) => {
          if (invoice && invoice.invoiceId) {
            return this.invoiceRepo.getById(invoice.invoiceId);
          } else {
            return of();
          }
        }),
      )
      .subscribe({
        next: (event) => this.receivedInvoices$.next(event),
        error: (err) => this.receivedInvoices$.error(err),
        complete: () => this.logger.debug("Finished reading InvoiceEvents"),
      });

    from(this.yagna.debitNoteEvents$)
      .pipe(
        mergeMap((debitNote) => {
          if (debitNote && debitNote.debitNoteId) {
            return this.debitNoteRepo.getById(debitNote.debitNoteId);
          } else {
            return of();
          }
        }),
      )
      .subscribe({
        next: (event) => this.receivedDebitNotes$.next(event),
        error: (err) => this.receivedDebitNotes$.error(err),
        complete: () => this.logger.debug("Finished reading DebitNoteEvents"),
      });

    this.logger.debug("Payment API Adapter connected");
  }

  getInvoice(id: string): Promise<Invoice> {
    return this.invoiceRepo.getById(id);
  }

  getDebitNote(id: string): Promise<DebitNote> {
    return this.debitNoteRepo.getById(id);
  }

  async disconnect() {
    this.logger.debug("Disconnecting Payment API Adapter");
    this.logger.debug("Payment API Adapter disconnected");
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
