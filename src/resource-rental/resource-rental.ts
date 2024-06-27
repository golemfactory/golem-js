import { Agreement } from "../market/agreement/agreement";
import { AgreementPaymentProcess, PaymentProcessOptions } from "../payment/agreement_payment_process";
import { createAbortSignalFromTimeout, Logger } from "../shared/utils";
import { waitForCondition } from "../shared/utils/wait";
import { ActivityModule, ExeUnit, ExeUnitOptions } from "../activity";
import { StorageProvider } from "../shared/storage";
import { EventEmitter } from "eventemitter3";
import { NetworkNode } from "../network";
import { ExecutionOptions } from "../activity/exe-script-executor";
import { MarketModule } from "../market";
import { GolemAbortError, GolemTimeoutError, GolemUserError } from "../shared/error/golem-error";

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
  private exeUnitPromise?: Promise<ExeUnit>;

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
    this.createExeUnit(this.abortController.signal);
    // TODO: Listen to agreement events to know when it goes down due to provider closing it!
  }

  /**
   * Terminates the activity and agreement (stopping any ongoing work) and finalizes the payment process.
   * Resolves when the rental will be fully terminated and all pending business operations finalized.
   * If the rental is already finalized, it will resolve immediately.
   * @param signalOrTimeout - timeout in milliseconds or an AbortSignal that will be used to cancel the finalization process, especially the payment process.
   * Please note that canceling the payment process may fail to comply with the terms of the agreement.
   */
  async stopAndFinalize(signalOrTimeout?: number | AbortSignal) {
    // Prevent this task from being performed more than once
    if (!this.finalizePromise) {
      this.finalizePromise = (async () => {
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
          const abortSignal = createAbortSignalFromTimeout(signalOrTimeout);
          await waitForCondition(() => this.paymentProcess.isFinished(), {
            signalOrTimeout: abortSignal,
          }).catch((error) => {
            this.paymentProcess.stop();
            if (error instanceof GolemTimeoutError) {
              throw new GolemTimeoutError(
                `The finalization of payment process has been aborted due to a timeout`,
                abortSignal.reason,
              );
            }
            throw new GolemAbortError("The finalization of payment process has been aborted", abortSignal.reason);
          });
          this.logger.info("Payment process for agreement finalized", { agreementId: this.agreement.id });
        } catch (error) {
          this.logger.error("Payment process finalization failed", { agreementId: this.agreement.id, error });
          throw error;
        } finally {
          this.events.emit("finalized");
        }
      })();
    }
    return this.finalizePromise;
  }

  public hasActivity(): boolean {
    return this.currentExeUnit !== null;
  }

  /**
   * Creates an activity on the Provider, and returns a exe-unit that can be used to operate within the activity
   * @param signalOrTimeout - timeout in milliseconds or an AbortSignal that will be used to cancel the exe-unit request,
   * especially when the exe-unit is in the process of starting, deploying and preparing the environment (including setup function)
   */
  async getExeUnit(signalOrTimeout?: number | AbortSignal): Promise<ExeUnit> {
    if (this.finalizePromise || this.abortController.signal.aborted) {
      throw new GolemUserError("The resource rental is not active. It may have been aborted or finalized");
    }
    if (this.currentExeUnit !== null) {
      return this.currentExeUnit;
    }
    const abortController = new AbortController();
    this.abortController.signal.addEventListener("abort", () =>
      abortController.abort(this.abortController.signal.reason),
    );
    if (signalOrTimeout) {
      const abortSignal = createAbortSignalFromTimeout(signalOrTimeout);
      abortSignal.addEventListener("abort", () => abortController.abort(abortSignal.reason));
      if (signalOrTimeout instanceof AbortSignal && signalOrTimeout.aborted) {
        abortController.abort(signalOrTimeout.reason);
      }
    }
    return this.createExeUnit(abortController.signal);
  }

  /**
   * Destroy previously created exe-unit.
   * Please note that if ResourceRental is left without ExeUnit for some time (default 90s)
   * the provider will terminate the Agreement and ResourceRental will be unuseble
   */
  async destroyExeUnit() {
    if (this.currentExeUnit !== null) {
      await this.activityModule.destroyActivity(this.currentExeUnit.activity);
      this.currentExeUnit = null;
    } else {
      throw new GolemUserError(`There is no exe-unit to destroy.`);
    }
  }

  async fetchAgreementState() {
    return this.marketModule.fetchAgreement(this.agreement.id).then((agreement) => agreement.getState());
  }

  private async createExeUnit(abortSignal: AbortSignal) {
    if (!this.exeUnitPromise) {
      this.exeUnitPromise = (async () => {
        const activity = await this.activityModule.createActivity(this.agreement);
        this.currentExeUnit = await this.activityModule.createExeUnit(activity, {
          storageProvider: this.storageProvider,
          networkNode: this.resourceRentalOptions?.networkNode,
          executionOptions: this.resourceRentalOptions?.activity,
          signalOrTimeout: abortSignal,
          ...this.resourceRentalOptions?.exeUnit,
        });
        return this.currentExeUnit;
      })()
        .catch((error) => {
          this.logger.error(`Failed to create exe-unit. ${error}`, { agreementId: this.agreement.id });
          throw error;
        })
        .finally(() => {
          this.exeUnitPromise = undefined;
        });
    }
    return this.exeUnitPromise;
  }
}
