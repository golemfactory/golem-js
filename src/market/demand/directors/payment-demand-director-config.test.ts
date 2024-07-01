import { PaymentDemandDirectorConfig } from "./payment-demand-director-config";

describe("PaymentDemandDirectorConfig", () => {
  it("should throw user error if debitNotesAcceptanceTimeoutSec option is invalid", () => {
    expect(() => {
      new PaymentDemandDirectorConfig({
        debitNotesAcceptanceTimeoutSec: -3,
      });
    }).toThrow("The debit note acceptance timeout time has to be a positive integer");
  });

  it("should throw user error if midAgreementDebitNoteIntervalSec option is invalid", () => {
    expect(() => {
      new PaymentDemandDirectorConfig({
        midAgreementDebitNoteIntervalSec: -3,
      });
    }).toThrow("The debit note interval time has to be a positive integer");
  });

  it("should throw user error if midAgreementPaymentTimeoutSec option is invalid", () => {
    expect(() => {
      new PaymentDemandDirectorConfig({
        midAgreementPaymentTimeoutSec: -3,
      });
    }).toThrow("The mid-agreement payment timeout time has to be a positive integer");
  });
});
