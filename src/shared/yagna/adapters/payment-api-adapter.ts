import { from, mergeMap, of, Subject } from "rxjs";
import {
  Allocation,
  CreateAllocationParams,
  DebitNote,
  GolemPaymentError,
  Invoice,
  IPaymentApi,
  PaymentErrorCode,
} from "../../../payment";
import { IInvoiceRepository } from "../../../payment/invoice";
import { Logger, YagnaApi } from "../../utils";
import { IDebitNoteRepository } from "../../../payment/debit_note";
import { getMessageFromApiError } from "../../utils/apiErrorMessage";

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
    try {
      await this.yagna.payment.acceptInvoice(invoice.id, {
        totalAmountAccepted: amount,
        allocationId: allocation.id,
      });

      return this.invoiceRepo.getById(invoice.id);
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemPaymentError(
        `Could not accept invoice. ${message}`,
        PaymentErrorCode.InvoiceAcceptanceFailed,
        allocation,
        invoice.provider,
      );
    }
  }

  async rejectInvoice(invoice: Invoice, reason: string): Promise<Invoice> {
    try {
      await this.yagna.payment.rejectInvoice(invoice.id, {
        rejectionReason: "BAD_SERVICE",
        totalAmountAccepted: "0.00",
        message: reason,
      });

      return this.invoiceRepo.getById(invoice.id);
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemPaymentError(
        `Could not reject invoice. ${message}`,
        PaymentErrorCode.InvoiceRejectionFailed,
        undefined,
        invoice.provider,
      );
    }
  }

  async acceptDebitNote(debitNote: DebitNote, allocation: Allocation, amount: string): Promise<DebitNote> {
    try {
      await this.yagna.payment.acceptDebitNote(debitNote.id, {
        totalAmountAccepted: amount,
        allocationId: allocation.id,
      });

      return this.debitNoteRepo.getById(debitNote.id);
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemPaymentError(
        `Could not accept debit note. ${message}`,
        PaymentErrorCode.DebitNoteAcceptanceFailed,
        allocation,
        debitNote.provider,
      );
    }
  }

  async rejectDebitNote(debitNote: DebitNote): Promise<DebitNote> {
    try {
      // TODO: this endpoint is not implemented in Yagna, it always responds 501:NotImplemented.
      // Reported in https://github.com/golemfactory/yagna/issues/1249
      // await this.yagna.payment.rejectDebitNote(debitNote.id, {
      //   rejectionReason: "BAD_SERVICE",
      //   totalAmountAccepted: "0.00",
      //   message: reason,
      // });

      return this.debitNoteRepo.getById(debitNote.id);
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemPaymentError(
        `Could not reject debit note. ${message}`,
        PaymentErrorCode.DebitNoteRejectionFailed,
        undefined,
        debitNote.provider,
        error,
      );
    }
  }

  async getAllocation(id: string) {
    try {
      const model = await this.yagna.payment.getAllocation(id);
      return new Allocation(model);
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemPaymentError(
        `Could not retrieve allocation. ${message}`,
        PaymentErrorCode.AllocationCreationFailed,
        undefined,
        undefined,
        error,
      );
    }
  }

  async createAllocation(params: CreateAllocationParams): Promise<Allocation> {
    try {
      const { identity: address } = await this.yagna.identity.getIdentity();

      const now = new Date();

      const model = await this.yagna.payment.createAllocation({
        totalAmount: params.budget.toString(),
        paymentPlatform: params.paymentPlatform,
        address,
        timestamp: now.toISOString(),
        timeout: new Date(+now + params.expirationSec * 1000).toISOString(),
        makeDeposit: false,
        remainingAmount: "",
        spentAmount: "",
        allocationId: "",
        deposit: params.deposit,
      });

      this.logger.debug(
        `Allocation ${model.allocationId} has been created for address ${address} using payment platform ${params.paymentPlatform}`,
      );

      const allocation = new Allocation(model);

      return allocation;
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemPaymentError(
        `Could not create new allocation. ${message}`,
        PaymentErrorCode.AllocationCreationFailed,
        undefined,
        undefined,
        error,
      );
    }
  }

  async releaseAllocation(allocation: Allocation): Promise<void> {
    try {
      return this.yagna.payment.releaseAllocation(allocation.id);
    } catch (error) {
      throw new GolemPaymentError(
        `Could not release allocation. ${error.response?.data?.message || error}`,
        PaymentErrorCode.AllocationReleaseFailed,
        allocation,
        undefined,
        error,
      );
    }
  }
}
