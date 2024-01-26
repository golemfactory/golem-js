import { Agreement } from "../agreement";
import { Invoice } from "./invoice";
import { DebitNote } from "./debit_note";
import { RejectionReason } from "./rejection";
import { Allocation } from "./allocation";
import { defaultLogger, Logger } from "..";
import { DebitNoteFilter, InvoiceFilter } from "./service";
import AsyncLock from "async-lock";
import { InvoiceStatus } from "ya-ts-client/dist/ya-payment";
import { GolemPaymentError, PaymentErrorCode } from "./error";

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

  public readonly logger: Logger;

  constructor(
    public readonly agreement: Agreement,
    public readonly allocation: Allocation,
    public readonly filters: {
      invoiceFilter: InvoiceFilter;
      debitNoteFilter: DebitNoteFilter;
    },
    logger?: Logger,
  ) {
    this.logger = logger || defaultLogger("payment");
  }

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
        `DebitNote ${debitNote.id} rejected because the agreement ${debitNote.agreementId} is already covered ` +
          `with a final invoice that should be paid instead of the debit note`,
      );
      return false;
    }

    if (this.debitNotes.has(debitNote.id)) {
      const isAlreadyProcessed = await this.hasProcessedDebitNote(debitNote);

      if (isAlreadyProcessed) {
        this.logger.warn(
          `We received a duplicate debit note - the previous one was already accepted, so this one gets ignored`,
          {
            debitNoteId: debitNote.id,
            agreementId: debitNote.agreementId,
          },
        );
        return false;
      }
    }

    this.debitNotes.set(debitNote.id, debitNote);

    const acceptedByFilter = await this.filters.debitNoteFilter(debitNote.dto);

    if (!acceptedByFilter) {
      await this.rejectDebitNote(
        debitNote,
        RejectionReason.RejectedByRequestorFilter,
        `DebitNote ${debitNote.id} for agreement ${debitNote.agreementId} rejected by DebitNote Filter`,
      );

      return false;
    }

    await debitNote.accept(debitNote.totalAmountDue, this.allocation.id);
    this.logger.debug(`DebitNote accepted`, {
      debitNoteId: debitNote.id,
      agreementId: debitNote.agreementId,
    });

    return true;
  }

  private async hasProcessedDebitNote(debitNote: DebitNote) {
    const status = await debitNote.getStatus();

    return status !== InvoiceStatus.Received;
  }

  private async rejectDebitNote(debitNote: DebitNote, rejectionReason: RejectionReason, rejectMessage: string) {
    const reason = {
      rejectionReason: rejectionReason,
      totalAmountAccepted: "0",
      message: rejectMessage,
    };

    await debitNote.reject(reason);

    this.logger.warn(`DebitNote rejected`, { reason: reason.message });
  }

  private async applyInvoice(invoice: Invoice) {
    if (this.invoice) {
      if (invoice.isSameAs(this.invoice)) {
        const previousStatus = await this.invoice.getStatus();

        if (previousStatus !== InvoiceStatus.Received) {
          this.logger.warn(`Received duplicate of an already processed invoice , the new one will be ignored`, {
            invoiceId: invoice.id,
            agreementId: invoice.agreementId,
          });
          return false;
        }
      } else {
        // Protects from possible fraud: someone sends a second, different invoice for the same agreement
        throw new GolemPaymentError(
          `Agreement ${this.agreement.id} is already covered with an invoice: ${this.invoice.id}`,
          PaymentErrorCode.AgreementAlreadyPaid,
          this.allocation,
          this.invoice.provider,
        );
      }
    }

    const status = await invoice.getStatus();
    if (status !== InvoiceStatus.Received) {
      throw new GolemPaymentError(
        `The invoice ${invoice.id} for agreement ${invoice.agreementId} has status ${status}, ` +
          `but we can accept only the ones with status ${InvoiceStatus.Received}`,
        PaymentErrorCode.InvoiceAlreadyReceived,
        this.allocation,
        invoice.provider,
      );
    }

    this.invoice = invoice;

    const acceptedByFilter = await this.filters.invoiceFilter(invoice.dto);

    if (!acceptedByFilter) {
      const rejectionReason = RejectionReason.RejectedByRequestorFilter;
      const message = `Invoice ${invoice.id} for agreement ${invoice.agreementId} rejected by Invoice Filter`;
      await this.rejectInvoice(invoice, rejectionReason, message);

      return false;
    }

    await invoice.accept(invoice.amount, this.allocation.id);
    this.logger.info(`Invoice has been accepted`, {
      invoiceId: invoice.id,
      agreementId: invoice.agreementId,
      providerName: this.agreement.getProviderInfo().name,
    });

    return true;
  }

  private async rejectInvoice(
    invoice: Invoice,
    rejectionReason: RejectionReason.RejectedByRequestorFilter,
    message: string,
  ) {
    const reason = {
      rejectionReason: rejectionReason,
      totalAmountAccepted: "0",
      message: message,
    };

    await invoice.reject(reason);

    this.logger.warn(`Invoice rejected`, { reason: reason.message });
  }

  private hasReceivedInvoice() {
    return this.invoice !== null;
  }
}
