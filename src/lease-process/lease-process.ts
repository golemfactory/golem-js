import { Agreement } from "../market/agreement/agreement";
import { AgreementPaymentProcess, PaymentProcessOptions } from "../payment/agreement_payment_process";
import { createAbortSignalFromTimeout, Logger } from "../shared/utils";
import { waitForCondition } from "../shared/utils/wait";
import { ActivityModule, WorkContext } from "../activity";
import { StorageProvider } from "../shared/storage";
import { EventEmitter } from "eventemitter3";
import { NetworkNode } from "../network";
import { ExecutionOptions } from "../activity/exe-script-executor";
import { MarketModule } from "../market";
import { GolemUserError } from "../shared/error/golem-error";

export interface LeaseProcessEvents {
  /**
   * Raised when the lease process is fully finalized
   */
  finalized: () => void;
}

export interface LeaseProcessOptions {
  activity?: ExecutionOptions;
  payment?: Partial<PaymentProcessOptions>;
  networkNode?: NetworkNode;
  signalOrTimeout?: number | AbortSignal;
}

/**
 * Represents a set of use-cases for invoking commands
 */

export class LeaseProcess {
  public readonly events = new EventEmitter<LeaseProcessEvents>();
  public readonly networkNode?: NetworkNode;

  private currentWorkContext: WorkContext | null = null;
  private abortController = new AbortController();
  private finalizeTask?: () => Promise<void>;

  public constructor(
    public readonly agreement: Agreement,
    private readonly storageProvider: StorageProvider,
    private readonly paymentProcess: AgreementPaymentProcess,
    private readonly marketModule: MarketModule,
    private readonly activityModule: ActivityModule,
    private readonly logger: Logger,
    private readonly leaseOptions?: LeaseProcessOptions,
  ) {
    this.networkNode = this.leaseOptions?.networkNode;

    const abortSignal = createAbortSignalFromTimeout(leaseOptions?.signalOrTimeout);
    abortSignal.addEventListener("abort", () => this.abortController.abort(abortSignal.reason));
    this.abortController.signal.addEventListener("abort", () => {
      this.logger.warn("The lease process has been aborted.", { reason: this.abortController.signal.reason });
      this.finalize();
    });

    // TODO: Listen to agreement events to know when it goes down due to provider closing it!
  }

  /**
   * Resolves when the lease will be fully terminated and all pending business operations finalized.
   * If the lease is already finalized, it will resolve immediately.
   */
  async finalize() {
    // Prevent to call this method  more than once
    if (!this.finalizeTask) {
      this.finalizeTask = async () => {
        if (this.paymentProcess.isFinished()) {
          return;
        }
        try {
          this.logger.info("Waiting for payment process of agreement to finish", { agreementId: this.agreement.id });
          if (this.currentWorkContext) {
            await this.activityModule.destroyActivity(this.currentWorkContext.activity);
          }
          if ((await this.fetchAgreementState()) !== "Terminated") {
            await this.marketModule.terminateAgreement(this.agreement);
          }
          await waitForCondition(() => this.paymentProcess.isFinished());
          this.logger.info("Payment process for agreement finalized", { agreementId: this.agreement.id });
        } catch (error) {
          this.logger.error("Payment process finalization failed", { agreementId: this.agreement.id, error });
          throw error;
        } finally {
          this.events.emit("finalized");
        }
      };
    }
    return this.finalizeTask();
  }

  public hasActivity(): boolean {
    return this.currentWorkContext !== null;
  }

  public abort(reason?: Error | string) {
    this.abortController.abort(reason);
    return this.abortController;
  }

  /**
   * Creates an activity on the Provider, and returns a work context that can be used to operate within the activity
   */
  async getExeUnit(): Promise<WorkContext> {
    if (this.finalizeTask || this.abortController.signal.aborted) {
      throw new GolemUserError("The lease process is not active. It may have been aborted or finalized");
    }
    if (this.currentWorkContext) {
      return this.currentWorkContext;
    }

    const activity = await this.activityModule.createActivity(this.agreement);
    this.currentWorkContext = await this.activityModule.createWorkContext(activity, {
      storageProvider: this.storageProvider,
      networkNode: this.leaseOptions?.networkNode,
      execution: { ...this.leaseOptions?.activity },
      signalOrTimeout: this.abortController.signal,
    });

    return this.currentWorkContext;
  }

  async destroyExeUnit() {
    if (this.currentWorkContext) {
      await this.activityModule.destroyActivity(this.currentWorkContext.activity);
      this.currentWorkContext = null;
    } else {
      throw new Error(`There is no activity to destroy.`);
    }
  }

  async fetchAgreementState() {
    return this.marketModule.fetchAgreement(this.agreement.id).then((agreement) => agreement.getState());
  }
}
