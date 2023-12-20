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
        `DebitNote ${debitNote.id} rejected because the agreement ${debitNote.agreementId} is already covered ` +
          `with a final invoice that should be paid instead of the debit note`,
      );
      return false;
    }

    if (this.debitNotes.has(debitNote.id)) {
      const isAlreadyProcessed = await this.hasProcessedDebitNote(debitNote);

      if (isAlreadyProcessed) {
        this.logger?.warn(
          `We received a duplicate debit note ${debitNote.id} for agreement ${debitNote.agreementId} ` +
            `- the previous one was already accepted, so this one gets ignored`,
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
    this.logger?.debug(`DebitNote ${debitNote.id} accepted for agreement ${debitNote.agreementId}`);

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
    this.logger?.warn(
      `DebitNote ${debitNote.id} has been rejected for agreement ${debitNote.agreementId}. Reason: ${reason.message}`,
    );
  }

  private async applyInvoice(invoice: Invoice) {
    if (this.invoice) {
      if (invoice.isSameAs(this.invoice)) {
        const previousStatus = await this.invoice.getStatus();

        if (previousStatus !== InvoiceStatus.Received) {
          this.logger?.warn(
            `Received duplicate of an already processed invoice ${invoice.id} for agreement ${invoice.agreementId}, ` +
              `the new one will be ignored`,
          );
          return false;
        }
      } else {
        // Protects from possible fraud: someone sends a second, different invoice for the same agreement
        throw new Error(`Agreement ${this.agreement.id} is already covered with an invoice: ${this.invoice.id}`);
      }
    }

    const status = await invoice.getStatus();
    if (status !== InvoiceStatus.Received) {
      throw new Error(
        `The invoice ${invoice.id} for agreement ${invoice.agreementId} has status ${status}, ` +
          `but we can accept only the ones with status ${InvoiceStatus.Received}`,
      );
    }

    this.invoice = invoice;

    const acceptedByFilter = await this.filters.invoiceFilter(invoice.dto);

    if (!acceptedByFilter) {
      const reason = {
        rejectionReason: RejectionReason.RejectedByRequestorFilter,
        totalAmountAccepted: "0",
        message: `Invoice ${invoice.id} for agreement ${invoice.agreementId} rejected by Invoice Filter`,
      };
      await invoice.reject(reason);
      this.logger?.warn(
        `Invoice ${invoice.id} for agreement ${invoice.agreementId} from provider ${this.agreement.provider.name} ` +
          `has been rejected. Reason: ${reason.message}`,
      );

      return false;
    }

    await invoice.accept(invoice.amount, this.allocation.id);
    this.logger?.info(
      `Invoice ${invoice.id} for agreement ${invoice.agreementId} from provider ${this.agreement.provider.name} has been accepted`,
    );

    return true;
  }

  private hasReceivedInvoice() {
    return this.invoice !== null;
  }
}
