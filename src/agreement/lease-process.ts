import { Allocation, DebitNote, Invoice } from "../payment";
import { BehaviorSubject, filter } from "rxjs";
import { Agreement, IAgreementApi } from "./agreement";
import { AgreementPaymentProcess } from "../payment/agreement_payment_process";
import { DebitNoteFilter, InvoiceFilter } from "../payment/service";
import { Logger, YagnaApi } from "../shared/utils";
import { waitForCondition } from "../shared/utils/waitForCondition";
import { WorkContext } from "../activity/work";
import { Activity, ActivityStateEnum } from "../activity";

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

/**
 * Represents a set of use cases related to managing the lifetime of an activity
 */
export interface IActivityApi {
  getActivity(id: string): Promise<Activity>;

  createActivity(agreement: Agreement): Promise<Activity>;

  destroyActivity(activity: Activity): Promise<Activity>;

  getActivityState(id: string): Promise<ActivityStateEnum>;

  // executeScript(script: Script, mode: "stream" | "poll"): Promise<Readable>;
}

/**
 * Represents a set of use-cases for invoking commands
 */

export class LeaseProcess {
  private paymentProcess: AgreementPaymentProcess;

  private currentActivity: Activity | null = null;

  public constructor(
    private readonly agreement: Agreement,
    private readonly allocation: Allocation,
    private readonly paymentApi: IPaymentApi,
    private readonly activityApi: IActivityApi,
    private readonly agreementApi: IAgreementApi,
    private readonly logger: Logger,
    /** @deprecated This will be removed, we want to have a nice adapter here */
    private readonly yagna: YagnaApi,
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
  async finalize() {
    this.logger.debug("Waiting for payment process of agreement to finish", { agreementId: this.agreement.id });
    if (this.currentActivity) {
      await this.activityApi.destroyActivity(this.currentActivity);
      await this.agreementApi.terminateAgreement(this.agreement);
    }
    await waitForCondition(() => {
      return this.paymentProcess.isFinished();
    });
    this.logger.debug("Payment process for agreement finalized", { agreementId: this.agreement.id });
  }

  /**
   * Creates an activity on the Provider, and returns a work context that can be used to operate within the activity
   */
  async getExeUnit(): Promise<WorkContext> {
    if (this.currentActivity) {
      throw new Error("There is already an activity present");
    }

    const activity = await this.activityApi.createActivity(this.agreement);
    this.currentActivity = activity;

    // Access your work context to perform operations
    const ctx = new WorkContext(this.activityApi, this.yagna.activity.control, this.yagna.activity.exec, activity, {});
    await ctx.before();

    return ctx;
  }

  async destroyExeUnit(ctx?: WorkContext) {
    if (this.currentActivity && ctx?.activity.id === this.currentActivity?.id) {
      await this.activityApi.destroyActivity(this.currentActivity);
      this.currentActivity = null;
    } else {
      throw new Error(
        `You cannot destroy activity ${ctx?.activity.id} because the current activity is ${this.currentActivity?.id}`,
      );
    }
  }
}
