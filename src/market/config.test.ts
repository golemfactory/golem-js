import { DemandConfig } from "./config";

describe("Demand Config", () => {
  describe("Positive cases", () => {
    it("It will accept proper config values without an error", () => {
      const config = new DemandConfig({
        expirationSec: 30 * 60,
        debitNotesAcceptanceTimeoutSec: 20,
        midAgreementPaymentTimeoutSec: 12 * 60 * 60,
      });

      expect(config).toBeDefined();
    });
  });
  describe("Negative cases", () => {
    const INVALID_VALUES = [-1, 0, 1.23];

    describe("Expiration time configuration", () => {
      test.each(INVALID_VALUES)("It should throw an error when someone specifies %d as expiration time", (value) => {
        expect(
          () =>
            new DemandConfig({
              expirationSec: value,
            }),
        ).toThrow("The demand expiration time has to be a positive integer");
      });
    });

    describe("Debit note acceptance timeout configuration", () => {
      test.each(INVALID_VALUES)(
        "It should throw an error when someone specifies %d as debit note accept timeout",
        (value) => {
          expect(
            () =>
              new DemandConfig({
                debitNotesAcceptanceTimeoutSec: value,
              }),
          ).toThrow("The debit note acceptance timeout time has to be a positive integer");
        },
      );
    });

    describe("Mid-agreement payments timeout configuration", () => {
      test.each(INVALID_VALUES)(
        "It should throw an error when someone specifies %d as mid-agreement payment timeout",
        (value) => {
          expect(
            () =>
              new DemandConfig({
                midAgreementPaymentTimeoutSec: value,
              }),
          ).toThrow("The mid-agreement payment timeout time has to be a positive integer");
        },
      );
    });
  });
});
