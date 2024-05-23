import { GolemModuleError } from "../shared/error/golem-error";
import { Allocation } from "./allocation";
import { ProviderInfo } from "../market/agreement";

export enum PaymentErrorCode {
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
  InvoiceAlreadyReceived = "InvoiceAlreadyReceived",
}
export class GolemPaymentError extends GolemModuleError {
  #allocation?: Allocation;
  #provider?: ProviderInfo;
  constructor(
    message: string,
    public code: PaymentErrorCode,
    allocation?: Allocation,
    provider?: ProviderInfo,
    public previous?: Error,
  ) {
    super(message, code, previous);
    this.#allocation = allocation;
    this.#provider = provider;
  }
  public getAllocation(): Allocation | undefined {
    return this.#allocation;
  }
  public getProvider(): ProviderInfo | undefined {
    return this.#provider;
  }
}
