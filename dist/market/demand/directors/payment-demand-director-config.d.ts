import { BaseConfig } from "./base-config";
export interface PaymentDemandDirectorConfigOptions {
    midAgreementDebitNoteIntervalSec: number;
    midAgreementPaymentTimeoutSec: number;
    debitNotesAcceptanceTimeoutSec: number;
}
export declare class PaymentDemandDirectorConfig extends BaseConfig implements PaymentDemandDirectorConfigOptions {
    readonly debitNotesAcceptanceTimeoutSec: number;
    readonly midAgreementDebitNoteIntervalSec: number;
    readonly midAgreementPaymentTimeoutSec: number;
    constructor(options?: Partial<PaymentDemandDirectorConfigOptions>);
}
