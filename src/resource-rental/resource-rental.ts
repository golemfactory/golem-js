import { Agreement } from "../market/agreement/agreement";
import { AgreementPaymentProcess, PaymentProcessOptions } from "../payment/agreement_payment_process";
import { Logger } from "../shared/utils";
import { waitForCondition } from "../shared/utils/wait";
import { ActivityModule, ExeUnit, ExeUnitOptions } from "../activity";
import { StorageProvider } from "../shared/storage";
import { EventEmitter } from "eventemitter3";
import { NetworkNode } from "../network";
import { ExecutionOptions } from "../activity/exe-script-executor";
import { MarketModule } from "../market";
import { GolemUserError } from "../shared/error/golem-error";

export interface ResourceRentalEvents {
  /**
   * Raised when the rental process is fully finalized
   */
  finalized: () => void;
}

export interface ResourceRentalOptions {
  exeUnit?: Pick<ExeUnitOptions, "setup" | "teardown" | "activityDeployingTimeout">;
  activity?: ExecutionOptions;
  payment?: Partial<PaymentProcessOptions>;
  networkNode?: NetworkNode;
}

/**
 * Combines an agreement, activity, exe unit and payment process into a single high-level abstraction.
 */
export class ResourceRental {
  public readonly events = new EventEmitter<ResourceRentalEvents>();
  public readonly networkNode?: NetworkNode;

  private currentExeUnit: ExeUnit | null = null;
  private abortController = new AbortController();
  private finalizePromise?: Promise<void>;

  public constructor(
    public readonly agreement: Agreement,
    private readonly storageProvider: StorageProvider,
    private readonly paymentProcess: AgreementPaymentProcess,
    private readonly marketModule: MarketModule,
    private readonly activityModule: ActivityModule,
    private readonly logger: Logger,
    private readonly resourceRentalOptions?: ResourceRentalOptions,
  ) {
    this.networkNode = this.resourceRentalOptions?.networkNode;

    // TODO: Listen to agreement events to know when it goes down due to provider closing it!
  }

  private async startStopAndFinalize() {
    try {
      if (this.currentExeUnit) {
        await this.currentExeUnit.teardown();
      }
      this.abortController.abort("The resource rental is finalizing");
      if (this.currentExeUnit?.activity) {
        await this.activityModule.destroyActivity(this.currentExeUnit.activity);
      }
      if ((await this.fetchAgreementState()) !== "Terminated") {
        await this.marketModule.terminateAgreement(this.agreement);
      }
      if (this.paymentProcess.isFinished()) {
        return;
      }

      this.logger.info("Waiting for payment process of agreement to finish", { agreementId: this.agreement.id });
      await waitForCondition(() => this.paymentProcess.isFinished());
      this.logger.info("Payment process for agreement finalized", { agreementId: this.agreement.id });
    } catch (error) {
      this.logger.error("Payment process finalization failed", { agreementId: this.agreement.id, error });
      throw error;
    } finally {
      this.events.emit("finalized");
    }
  }

  /**
   * Terminates the activity and agreement (stopping any ongoing work) and finalizes the payment process.
   * Resolves when the rental will be fully terminated and all pending business operations finalized.
   * If the rental is already finalized, it will resolve immediately.
   */
  async stopAndFinalize() {
    if (this.finalizePromise) {
      return this.finalizePromise;
    }
    this.finalizePromise = this.startStopAndFinalize().finally(() => {
      this.finalizePromise = undefined;
    });
    return this.finalizePromise;
  }

  public hasActivity(): boolean {
    return this.currentExeUnit !== null;
  }

  /**
   * Creates an activity on the Provider, and returns a exe-unit that can be used to operate within the activity
   */
  async getExeUnit(): Promise<ExeUnit> {
    if (this.finalizePromise || this.abortController.signal.aborted) {
      throw new GolemUserError("The resource rental is not active. It may have been aborted or finalized");
    }
    if (this.currentExeUnit) {
      return this.currentExeUnit;
    }

    const activity = await this.activityModule.createActivity(this.agreement);
    this.currentExeUnit = await this.activityModule.createExeUnit(activity, {
      storageProvider: this.storageProvider,
      networkNode: this.resourceRentalOptions?.networkNode,
      executionOptions: this.resourceRentalOptions?.activity,
      signalOrTimeout: this.abortController.signal,
      ...this.resourceRentalOptions?.exeUnit,
    });

    return this.currentExeUnit;
  }

  async destroyExeUnit() {
    if (this.currentExeUnit) {
      await this.activityModule.destroyActivity(this.currentExeUnit.activity);
      this.currentExeUnit = null;
    } else {
      throw new Error(`There is no activity to destroy.`);
    }
  }

  async fetchAgreementState() {
    return this.marketModule.fetchAgreement(this.agreement.id).then((agreement) => agreement.getState());
  }
}
