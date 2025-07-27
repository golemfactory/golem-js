import { GolemModuleError } from "../shared/error/golem-error";
import { Allocation } from "./allocation";
import { ProviderInfo } from "../market/agreement";
export declare enum PaymentErrorCode {
    AllocationCreationFailed = "AllocationCreationFailed",
    MissingAllocation = "MissingAllocation",
    PaymentProcessNotInitialized = "PaymentProcessNotInitialized",
    AllocationReleaseFailed = "AllocationReleaseFailed",
    InvoiceAcceptanceFailed = "InvoiceAcceptanceFailed",
    DebitNoteAcceptanceFailed = "DebitNoteAcceptanceFailed",
    InvoiceRejectionFailed = "InvoiceRejectionFailed",
    DebitNoteRejectionFailed = "DebitNoteRejectionFailed",
    CouldNotGetDebitNote = "CouldNotGetDebitNote",
    CouldNotGetInvoice = "CouldNotGetInvoice",
    PaymentStatusQueryFailed = "PaymentStatusQueryFailed",
    AgreementAlreadyPaid = "AgreementAlreadyPaid",
    InvoiceAlreadyReceived = "InvoiceAlreadyReceived"
}
export declare class GolemPaymentError extends GolemModuleError {
    #private;
    code: PaymentErrorCode;
    previous?: Error | undefined;
    constructor(message: string, code: PaymentErrorCode, allocation?: Allocation, provider?: ProviderInfo, previous?: Error | undefined);
    getAllocation(): Allocation | undefined;
    getProvider(): ProviderInfo | undefined;
}
