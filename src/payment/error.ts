import { GolemModuleError } from "../error/golem-error";
import { Allocation } from "./allocation";
import { ProviderInfo } from "../agreement";

export enum PaymentErrorCode {
  AllocationCreationFailed,
  MissingAllocation,
  PaymentProcessNotInitialized,
  AllocationReleaseFailed,
  InvoiceAcceptanceFailed,
  DebitNoteAcceptanceFailed,
  InvoiceRejectionFailed,
  DebitNoteRejectionFailed,
  PaymentStatusQueryFailed,
  AgreementAlreadyPaid,
  InvoiceAlreadyReceived,
}
export class GolemPaymentError extends GolemModuleError {
  constructor(
    message: string,
    public code: PaymentErrorCode,
    public allocation?: Allocation,
    public provider?: ProviderInfo,
    public previous?: Error,
  ) {
    super(message, code, previous);
  }
}
