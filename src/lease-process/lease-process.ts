import { Agreement } from "../market/agreement/agreement";
import { AgreementPaymentProcess, PaymentProcessOptions } from "../payment/agreement_payment_process";
import { Logger } from "../shared/utils";
import { waitForCondition } from "../shared/utils/wait";
import { ActivityModule, WorkContext } from "../activity";
import { StorageProvider } from "../shared/storage";
import { EventEmitter } from "eventemitter3";
import { NetworkNode } from "../network";
import { ExecutionOptions } from "../activity/exe-script-executor";
import { MarketModule } from "../market";

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
}

/**
 * Represents a set of use-cases for invoking commands
 */

export class LeaseProcess {
  public readonly events = new EventEmitter<LeaseProcessEvents>();
  public readonly networkNode?: NetworkNode;

  private currentWorkContext: WorkContext | null = null;

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

    // TODO: Listen to agreement events to know when it goes down due to provider closing it!
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
      if (this.currentWorkContext) {
        await this.activityModule.destroyActivity(this.currentWorkContext.activity);
        if ((await this.fetchAgreementState()) !== "Terminated") {
          await this.marketModule.terminateAgreement(this.agreement);
        }
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
    return this.currentWorkContext !== null;
  }

  /**
   * Creates an activity on the Provider, and returns a work context that can be used to operate within the activity
   */
  async getExeUnit(): Promise<WorkContext> {
    if (this.currentWorkContext) {
      return this.currentWorkContext;
    }

    const activity = await this.activityModule.createActivity(this.agreement);
    this.currentWorkContext = await this.activityModule.createWorkContext(activity, {
      storageProvider: this.storageProvider,
      networkNode: this.leaseOptions?.networkNode,
      execution: this.leaseOptions?.activity,
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
