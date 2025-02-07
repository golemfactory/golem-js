import { Agreement, MarketModule } from "../market";
import { AgreementPaymentProcess, PaymentProcessOptions } from "../payment/agreement_payment_process";
import { Logger } from "../shared/utils";
import { Activity, ActivityModule, ExeUnit, ExeUnitOptions } from "../activity";
import { StorageProvider } from "../shared/storage";
import { EventEmitter } from "eventemitter3";
import { NetworkNode } from "../network";
import { ExecutionOptions } from "../activity/exe-script-executor";
export interface ResourceRentalEvents {
    /** Emitted when the rental process is fully finalized */
    finalized: () => void;
    /** Emitted when ExeUnit is successfully created and initialised */
    exeUnitCreated: (activity: Activity) => void;
    /** Emitted when the ExeUnit is successfully destroyed */
    exeUnitDestroyed: (activity: Activity) => void;
    /** Emitted when there is an error while creating or destroying the ExeUnit */
    error: (error: Error) => void;
}
export interface ResourceRentalOptions {
    exeUnit?: Pick<ExeUnitOptions, "setup" | "teardown" | "activityDeployingTimeout" | "volumes">;
    activity?: ExecutionOptions;
    payment?: Partial<PaymentProcessOptions>;
    networkNode?: NetworkNode;
}
/**
 * Combines an agreement, activity, exe unit and payment process into a single high-level abstraction.
 */
export declare class ResourceRental {
    readonly agreement: Agreement;
    private readonly storageProvider;
    private readonly paymentProcess;
    private readonly marketModule;
    private readonly activityModule;
    private readonly logger;
    private readonly resourceRentalOptions?;
    readonly events: EventEmitter<ResourceRentalEvents, any>;
    readonly networkNode?: NetworkNode;
    private currentExeUnit;
    private abortController;
    private finalizePromise?;
    private exeUnitPromise?;
    constructor(agreement: Agreement, storageProvider: StorageProvider, paymentProcess: AgreementPaymentProcess, marketModule: MarketModule, activityModule: ActivityModule, logger: Logger, resourceRentalOptions?: ResourceRentalOptions | undefined);
    private startStopAndFinalize;
    /**
     * Terminates the activity and agreement (stopping any ongoing work) and finalizes the payment process.
     * Resolves when the rental will be fully terminated and all pending business operations finalized.
     * If the rental is already finalized, it will resolve immediately with the last finalization result.
     * @param signalOrTimeout - timeout in milliseconds or an AbortSignal that will be used to cancel the finalization process, especially the payment process.
     * Please note that canceling the payment process may fail to comply with the terms of the agreement.
     * If this method is called multiple times, it will return the same promise, ignoring the signal or timeout.
     */
    stopAndFinalize(signalOrTimeout?: number | AbortSignal): Promise<void>;
    hasActivity(): boolean;
    /**
     * Creates an activity on the Provider, and returns a exe-unit that can be used to operate within the activity
     * @param signalOrTimeout - timeout in milliseconds or an AbortSignal that will be used to cancel the exe-unit request,
     * especially when the exe-unit is in the process of starting, deploying and preparing the environment (including setup function)
     */
    getExeUnit(signalOrTimeout?: number | AbortSignal): Promise<ExeUnit>;
    /**
     * Destroy previously created exe-unit.
     * Please note that if ResourceRental is left without ExeUnit for some time (default 90s)
     * the provider will terminate the Agreement and ResourceRental will be unuseble
     */
    destroyExeUnit(): Promise<void>;
    fetchAgreementState(): Promise<"Proposal" | "Pending" | "Cancelled" | "Rejected" | "Approved" | "Expired" | "Terminated">;
    private createExeUnit;
}
