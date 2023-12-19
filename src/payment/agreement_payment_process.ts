import { Agreement } from "../agreement";
import { Invoice } from "./invoice";
import { DebitNote } from "./debit_note";
import { RejectionReason } from "./rejection";
import { Allocation } from "./allocation";
import { Logger } from "..";
import { DebitNoteFilter, InvoiceFilter } from "./service";
import AsyncLock from "async-lock";
import { InvoiceStatus } from "ya-ts-client/dist/ya-payment";

/**
 * Process manager that controls the logic behind processing events related to an agreement which result with payments
 */
export class AgreementPaymentProcess {
  private invoice: Invoice | null = null;
  private debitNotes: Map<string, DebitNote> = new Map();

  /**
   * Lock used to synchronize callers and enforce important business rules
   *
   * Example of a rule: you shouldn't accept a debit note if an invoice is already in place
   */
  private lock: AsyncLock = new AsyncLock();

  constructor(
    public readonly agreement: Agreement,
    public readonly allocation: Allocation,
    public readonly filters: {
      invoiceFilter: InvoiceFilter;
      debitNoteFilter: DebitNoteFilter;
    },
    public readonly logger?: Logger,
  ) {}

  /**
   * Adds the debit note to the process avoiding race conditions
   */
  public addDebitNote(debitNote: DebitNote) {
    return this.lock.acquire(`app-${debitNote.agreementId}`, () => this.applyDebitNote(debitNote));
  }

  /**
   * Adds the invoice to the process avoiding race conditions
   */
  public addInvoice(invoice: Invoice) {
    return this.lock.acquire(`app-${invoice.agreementId}`, () => this.applyInvoice(invoice));
  }

  /**
   * Tells if the process reached a point in which we can consider it as "finished"
   */
  public isFinished() {
    return this.invoice !== null;
  }

  private async applyDebitNote(debitNote: DebitNote) {
    const isAlreadyFinalized = this.hasReceivedInvoice();

    if (isAlreadyFinalized) {
      await this.rejectDebitNote(
        debitNote,
        RejectionReason.AgreementFinalized,
        "DebitNote rejected because the agreement is already covered with a final invoice that should be paid instead of the debit note",
      );
      return false;
    }

    if (this.debitNotes.has(debitNote.id)) {
      const isAlreadyProcessed = await this.hasProcessedDebitNote(debitNote);

      if (isAlreadyProcessed) {
        this.logger?.warn(
          `We received a duplicate debit note for agreement ${debitNote.agreementId} - the previous one was already accepted, so this one gets ignored`,
        );
        return false;
      }
    }

    this.debitNotes.set(debitNote.id, debitNote);

    const acceptedByFilter = await this.filters.debitNoteFilter(debitNote.dto);

    if (acceptedByFilter) {
      await debitNote.accept(debitNote.totalAmountDue, this.allocation!.id);
      this.logger?.debug(`DebitNote accepted for agreement ${debitNote.agreementId}`);
      return true;
    } else {
      await this.rejectDebitNote(
        debitNote,
        RejectionReason.RejectedByRequestorFilter,
        "DebitNote rejected by DebitNote Filter",
      );

      return false;
    }
  }

  private async hasProcessedDebitNote(debitNote: DebitNote) {
    const status = await debitNote.getStatus();

    return status === InvoiceStatus.Accepted || status === InvoiceStatus.Settled || status === InvoiceStatus.Rejected;
  }

  private async rejectDebitNote(debitNote: DebitNote, rejectionReason: RejectionReason, rejectMessage: string) {
    const reason = {
      rejectionReason: rejectionReason,
      totalAmountAccepted: "0",
      message: rejectMessage,
    };
    await debitNote.reject(reason);
    this.logger?.warn(`DebitNote has been rejected for agreement ${debitNote.agreementId}. Reason: ${reason.message}`);
  }

  private async applyInvoice(invoice: Invoice) {
    const isAlreadyFinalized = await this.hasProcessedInvoice();

    if (isAlreadyFinalized) {
      throw new Error("This agreement is already covered with an invoice");
    }

    this.invoice = invoice;

    const acceptedByFilter = await this.filters.invoiceFilter(invoice.dto);

    if (acceptedByFilter) {
      await invoice.accept(invoice.amount, this.allocation.id);
      this.logger?.info(`Invoice accepted from provider ${this.agreement.provider.name}`);

      return true;
    } else {
      const reason = {
        rejectionReason: RejectionReason.RejectedByRequestorFilter,
        totalAmountAccepted: "0",
        message: "Invoice rejected by Invoice Filter",
      };
      await invoice.reject(reason);
      this.logger?.warn(
        `Invoice has been rejected for provider ${this.agreement.provider.name}. Reason: ${reason.message}`,
      );

      return false;
    }
  }

  private async hasProcessedInvoice() {
    if (this.invoice !== null) {
      const status = await this.invoice.getStatus();

      return status === InvoiceStatus.Accepted || status === InvoiceStatus.Settled || status === InvoiceStatus.Rejected;
    }

    return false;
  }

  private hasReceivedInvoice() {
    return this.invoice !== null;
  }
}
