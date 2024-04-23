import { Allocation, DebitNote, Invoice } from "../payment";
import { BehaviorSubject, filter } from "rxjs";
import { Agreement } from "./agreement";
import { AgreementPaymentProcess } from "../payment/agreement_payment_process";
import { DebitNoteFilter, InvoiceFilter } from "../payment/service";
import { Logger } from "../shared/utils";
import { waitForCondition } from "../shared/utils/waitForCondition";

export interface IPaymentApi {
  receivedInvoices$: BehaviorSubject<Invoice | null>;
  receivedDebitNotes$: BehaviorSubject<DebitNote | null>;

  getInvoice(id: string): Promise<Invoice>;

  acceptInvoice(invoice: Invoice, allocation: Allocation, amount: string): Promise<Invoice>;
  rejectInvoice(invoice: Invoice, reason: string): Promise<Invoice>;

  getDebitNote(id: string): Promise<DebitNote>;

  acceptDebitNote(debitNote: DebitNote, allocation: Allocation, amount: string): Promise<DebitNote>;
  rejectDebitNote(debitNote: DebitNote, reason: string): Promise<DebitNote>;
}

export class LeaseProcess {
  private paymentProcess: AgreementPaymentProcess;

  public constructor(
    private readonly agreement: Agreement,
    private readonly allocation: Allocation,
    private readonly paymentApi: IPaymentApi,
    private readonly logger: Logger,
    private readonly leaseOptions?: {
      paymentOptions: {
        invoiceFilter: InvoiceFilter;
        debitNoteFilter: DebitNoteFilter;
      };
    },
  ) {
    this.paymentProcess = new AgreementPaymentProcess(
      this.agreement,
      this.allocation,
      this.paymentApi,
      this.leaseOptions?.paymentOptions,
      this.logger,
    );

    // TODO: Could be hidden in the payment process itself!
    this.paymentApi.receivedInvoices$
      .pipe(filter((invoice) => invoice !== null && invoice.agreementId === this.agreement.id))
      .subscribe(async (invoice) => {
        if (invoice) {
          await this.paymentProcess.addInvoice(invoice);
        }
      });

    this.paymentApi.receivedDebitNotes$
      .pipe(filter((debitNote) => debitNote !== null && debitNote.agreementId === this.agreement.id))
      .subscribe(async (debitNote) => {
        if (debitNote) {
          await this.paymentProcess.addDebitNote(debitNote);
        }
      });
  }

  /**
   * @return Resolves when the lease will be fully terminated
   */
  async terminated() {
    return waitForCondition(() => this.paymentProcess.isFinished());
  }
}
