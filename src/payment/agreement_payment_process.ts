import { Agreement } from "../market/agreement";
import { Invoice } from "./invoice";
import { DebitNote } from "./debit_note";
import { RejectionReason } from "./rejection";
import { Allocation } from "./allocation";
import { defaultLogger, Logger } from "../shared/utils";
import AsyncLock from "async-lock";
import { GolemPaymentError, PaymentErrorCode } from "./error";
import { GolemUserError } from "../shared/error/golem-error";
import { IPaymentApi } from "./types";
import { getMessageFromApiError } from "../shared/utils/apiErrorMessage";
import { Demand } from "../market";

export type DebitNoteFilter = (
  debitNote: DebitNote,
  context: {
    agreement: Agreement;
    allocation: Allocation;
    demand: Demand;
  },
) => Promise<boolean> | boolean;
export type InvoiceFilter = (
  invoice: Invoice,
  context: {
    agreement: Agreement;
    allocation: Allocation;
    demand: Demand;
  },
) => Promise<boolean> | boolean;

export interface PaymentProcessOptions {
  invoiceFilter: InvoiceFilter;
  debitNoteFilter: DebitNoteFilter;
}

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
    public readonly paymentApi: IPaymentApi,
    public readonly options: PaymentProcessOptions = {
      invoiceFilter: () => true,
      debitNoteFilter: () => true,
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

    let acceptedByFilter = false;
    try {
      acceptedByFilter = await this.options.debitNoteFilter(debitNote, {
        agreement: this.agreement,
        allocation: this.allocation,
        demand: this.agreement.demand,
      });
    } catch (error) {
      throw new GolemUserError("An error occurred in the debit note filter", error);
    }

    if (!acceptedByFilter) {
      await this.rejectDebitNote(
        debitNote,
        RejectionReason.RejectedByRequestorFilter,
        `DebitNote ${debitNote.id} for agreement ${debitNote.agreementId} rejected by DebitNote Filter`,
      );

      return false;
    }

    try {
      await this.paymentApi.acceptDebitNote(debitNote, this.allocation, debitNote.totalAmountDue);
      this.logger.debug(`DebitNote accepted`, {
        debitNoteId: debitNote.id,
        agreementId: debitNote.agreementId,
      });
      // this.events.emit("accepted", {
      //   id: this.id,
      //   agreementId: this.agreementId,
      //   amount: totalAmountAccepted,
      //   provider: this.provider,
      // });

      return true;
    } catch (error) {
      const message = getMessageFromApiError(error);
      // this.events.emit("paymentFailed", { id: this.id, agreementId: this.agreementId, reason });
      throw new GolemPaymentError(
        `Unable to accept debit note ${debitNote.id}. ${message}`,
        PaymentErrorCode.DebitNoteAcceptanceFailed,
        undefined,
        debitNote.provider,
        error,
      );
    }
  }

  private async hasProcessedDebitNote(debitNote: DebitNote) {
    const status = await debitNote.getStatus();

    return status !== "RECEIVED";
  }

  private async rejectDebitNote(debitNote: DebitNote, rejectionReason: RejectionReason, rejectMessage: string) {
    try {
      // FIXME yagna 0.15 still doesn't support invoice rejections
      // await this.paymentApi.rejectDebitNote(debitNote, rejectMessage);
      this.logger.warn(`DebitNote rejected`, { reason: rejectMessage });
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemPaymentError(
        `Unable to reject debit note ${debitNote.id}. ${message}`,
        PaymentErrorCode.DebitNoteRejectionFailed,
        undefined,
        debitNote.provider,
        error,
      );
    } finally {
      // this.events.emit("paymentFailed", { id: this.id, agreementId: this.agreementId, reason: rejection.message });
    }
  }

  private async applyInvoice(invoice: Invoice) {
    this.logger.debug("Applying invoice for agreement", {
      invoiceId: invoice.id,
      agreementId: invoice.agreementId,
      provider: invoice.provider,
    });

    if (this.invoice) {
      // Protects from possible fraud: someone sends a second, different invoice for the same agreement
      throw new GolemPaymentError(
        `Agreement ${this.agreement.id} is already covered with an invoice: ${this.invoice.id}`,
        PaymentErrorCode.AgreementAlreadyPaid,
        this.allocation,
        this.invoice.provider,
      );
    }

    if (invoice.getStatus() !== "RECEIVED") {
      throw new GolemPaymentError(
        `The invoice ${invoice.id} for agreement ${invoice.agreementId} has status ${invoice.getStatus()}, ` +
          `but we can accept only the ones with status RECEIVED`,
        PaymentErrorCode.InvoiceAlreadyReceived,
        this.allocation,
        invoice.provider,
      );
    }

    this.invoice = invoice;

    let acceptedByFilter = false;
    try {
      acceptedByFilter = await this.options.invoiceFilter(invoice, {
        agreement: this.agreement,
        allocation: this.allocation,
        demand: this.agreement.demand,
      });
    } catch (error) {
      throw new GolemUserError("An error occurred in the invoice filter", error);
    }

    if (!acceptedByFilter) {
      const rejectionReason = RejectionReason.RejectedByRequestorFilter;
      const message = `Invoice ${invoice.id} for agreement ${invoice.agreementId} rejected by Invoice Filter`;
      await this.rejectInvoice(invoice, rejectionReason, message);

      return false;
    }

    try {
      await this.paymentApi.acceptInvoice(invoice, this.allocation, invoice.amount);
      this.logger.info(`Invoice has been accepted`, {
        invoiceId: invoice.id,
        agreementId: invoice.agreementId,
        amount: invoice.amount,
        provider: this.agreement.getProviderInfo(),
      });

      // this.events.emit("invoiceAccepted", {
      //   invoiceId: invoice.id,
      //   agreementId: invoice.agreementId,
      //   amount: totalAmountAccepted,
      //   provider: invoice.provider,
      // });
    } catch (error) {
      const message = getMessageFromApiError(error);

      // this.events.emit("paymentFailed", { invoiceId: invoice.id, agreementId: invoice.agreementId, reason });

      throw new GolemPaymentError(
        `Unable to accept invoice ${invoice.id} ${message}`,
        PaymentErrorCode.InvoiceAcceptanceFailed,
        undefined,
        invoice.provider,
        error,
      );
    }

    return true;
  }

  private async rejectInvoice(
    invoice: Invoice,
    rejectionReason: RejectionReason.RejectedByRequestorFilter,
    message: string,
  ) {
    try {
      await this.paymentApi.rejectInvoice(invoice, message);
      this.logger.warn(`Invoice rejected`, { reason: message });
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemPaymentError(
        `Unable to reject invoice ${invoice.id} ${message}`,
        PaymentErrorCode.InvoiceRejectionFailed,
        undefined,
        invoice.provider,
        error,
      );
    } finally {
      // this.events.emit("paymentFailed", { id: this.id, agreementId: this.agreementId, reason: rejection.message });
    }
  }

  private hasReceivedInvoice() {
    return this.invoice !== null;
  }
}
