import { Allocation, IPaymentApi } from "../payment";
import { filter } from "rxjs";
import { Agreement, IAgreementApi } from "../market/agreement/agreement";
import { AgreementPaymentProcess } from "../payment/agreement_payment_process";
import { DebitNoteFilter, InvoiceFilter } from "../payment/service";
import { Logger, YagnaApi } from "../shared/utils";
import { waitForCondition } from "../shared/utils/waitForCondition";
import { Activity, IActivityApi, WorkContext } from "../activity";
import { StorageProvider } from "../shared/storage";
import { EventEmitter } from "eventemitter3";

export interface LeaseProcessEvents {
  /**
   * Raised when the lease process is fully finalized
   */
  finalized: () => void;
}

/**
 * Represents a set of use-cases for invoking commands
 */

export class LeaseProcess {
  public readonly events = new EventEmitter<LeaseProcessEvents>();
  private paymentProcess: AgreementPaymentProcess;

  private currentActivity: Activity | null = null;

  public constructor(
    public readonly agreement: Agreement,
    private readonly allocation: Allocation,
    private readonly paymentApi: IPaymentApi,
    private readonly activityApi: IActivityApi,
    private readonly agreementApi: IAgreementApi,
    private readonly logger: Logger,
    /** @deprecated This will be removed, we want to have a nice adapter here */
    private readonly yagna: YagnaApi,
    private readonly storageProvider: StorageProvider,
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
      .pipe(filter((invoice) => invoice.agreementId === this.agreement.id))
      .subscribe(async (invoice) => {
        if (invoice) {
          await this.paymentProcess.addInvoice(invoice);
        }
      });

    this.paymentApi.receivedDebitNotes$
      .pipe(filter((debitNote) => debitNote.agreementId === this.agreement.id))
      .subscribe(async (debitNote) => {
        if (debitNote) {
          await this.paymentProcess.addDebitNote(debitNote);
        }
      });
  }

  /**
   * Resolves when the lease will be fully terminated and all pending business operations finalized.
   * If the lease is already finalized, it will resolve immediately.
   */
  async finalize() {
    if (this.paymentProcess.isFinished()) {
      return;
    }

    try {
      this.logger.debug("Waiting for payment process of agreement to finish", { agreementId: this.agreement.id });
      if (this.currentActivity) {
        await this.activityApi.destroyActivity(this.currentActivity);
        await this.agreementApi.terminateAgreement(this.agreement);
      }
      await waitForCondition(() => this.paymentProcess.isFinished());
      this.logger.debug("Payment process for agreement finalized", { agreementId: this.agreement.id });
    } catch (error) {
      this.logger.error("Payment process finalization failed", { agreementId: this.agreement.id, error });
      throw error;
    } finally {
      this.events.emit("finalized");
    }
  }

  public hasActivity(): boolean {
    return this.currentActivity !== null;
  }

  /**
   * Creates an activity on the Provider, and returns a work context that can be used to operate within the activity
   */
  async getExeUnit(): Promise<WorkContext> {
    if (this.currentActivity) {
      return new WorkContext(
        this.activityApi,
        this.yagna.activity.control,
        this.yagna.activity.exec,
        this.currentActivity,
        {
          storageProvider: this.storageProvider,
        },
      );
    }

    const activity = await this.activityApi.createActivity(this.agreement);
    this.currentActivity = activity;

    // Access your work context to perform operations
    const ctx = new WorkContext(this.activityApi, this.yagna.activity.control, this.yagna.activity.exec, activity, {
      storageProvider: this.storageProvider,
    });

    await ctx.before();

    return ctx;
  }

  async destroyExeUnit() {
    if (this.currentActivity) {
      await this.activityApi.destroyActivity(this.currentActivity);
      this.currentActivity = null;
    } else {
      throw new Error(`There is no activity to destroy.`);
    }
  }

  async fetchAgreementState() {
    return this.agreementApi.getAgreement(this.agreement.id).then((agreement) => agreement.getState());
  }
}
