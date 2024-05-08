import { BaseConfig } from "./base-config";
import { GolemConfigError } from "../../../shared/error/golem-error";

export interface PaymentDemandDirectorConfigOptions {
  midAgreementDebitNoteIntervalSec: number;
  midAgreementPaymentTimeoutSec: number;
  debitNotesAcceptanceTimeoutSec: number;
}

export class PaymentDemandDirectorConfig extends BaseConfig implements PaymentDemandDirectorConfigOptions {
  public readonly debitNotesAcceptanceTimeoutSec = 2 * 60; // 2 minutes
  public readonly midAgreementDebitNoteIntervalSec = 2 * 60; // 2 minutes
  public readonly midAgreementPaymentTimeoutSec = 12 * 60 * 60; // 12 hours

  constructor(options?: Partial<PaymentDemandDirectorConfigOptions>) {
    super();

    if (options) {
      Object.assign(this, options);
    }

    if (!this.isPositiveInt(this.debitNotesAcceptanceTimeoutSec)) {
      throw new GolemConfigError("The debit note acceptance timeout time has to be a positive integer");
    }

    if (!this.isPositiveInt(this.midAgreementDebitNoteIntervalSec)) {
      throw new GolemConfigError("The debit note interval time has to be a positive integer");
    }

    if (!this.isPositiveInt(this.midAgreementPaymentTimeoutSec)) {
      throw new GolemConfigError("The mid-agreement payment timeout time has to be a positive integer");
    }
  }
}
