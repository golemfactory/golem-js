import { Allocation, DebitNote, Invoice } from "../payment";
import { BehaviorSubject, filter } from "rxjs";
import { Agreement } from "./agreement";
import { AgreementPaymentProcess } from "../payment/agreement_payment_process";
import { DebitNoteFilter, InvoiceFilter } from "../payment/service";
import { Logger } from "../shared/utils";
import { waitForCondition } from "../shared/utils/waitForCondition";
import { WorkContext } from "../activity/work";

export interface IPaymentApi {
  receivedInvoices$: BehaviorSubject<Invoice | null>;
  receivedDebitNotes$: BehaviorSubject<DebitNote | null>;

  /** Starts the reader logic */
  connect(): Promise<void>;

  /** Terminates the reader logic */
  disconnect(): Promise<void>;

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
    // private readonly activityApi: IActivityApi, <---- This one will create the activity in the lease upon the request
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

    // TODO: Listen to agreement events to know when it goes down due to provider closing it!

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
   * @return Resolves when the lease will be fully terminated and all pending business operations finalized
   */
  async finalized() {
    this.logger.debug("Waiting for payment process of agreement to finish", { agreementId: this.agreement.id });
    await waitForCondition(() => {
      return this.paymentProcess.isFinished();
    });
    this.logger.debug("Payment process for agreement finalized", { agreementId: this.agreement.id });
  }

  /**
   * Creates an activity on the Provider, and returns a work context that can be used to operate within the activity
   */
  async getExeUnit(): Promise<WorkContext> {
    throw new Error("Not implemented");
  }
}
