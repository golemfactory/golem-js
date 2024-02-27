import { LoggerMock, YagnaMock } from "../mock";
import { Allocation, GolemPaymentError, PaymentErrorCode } from "../../src/payment";
import { GolemConfigError, GolemUserError } from "../../src/error/golem-error";
import { AllocationOptions } from "../../src/payment/allocation";

const logger = new LoggerMock();
const account = { address: "test_address", platform: "test_platform" };
const yagnaApi = new YagnaMock().getApi();

describe("Allocation", () => {
  beforeEach(() => logger.clear());

  describe("Creating", () => {
    it("should create allocation", async () => {
      const allocation = await Allocation.create(yagnaApi, { account });
      expect(allocation).toBeInstanceOf(Allocation);
    });

    it("should not create allocation without account options", async () => {
      const expectedPreviousError = new GolemConfigError("Account option is required");
      await expect(Allocation.create(yagnaApi, {} as AllocationOptions)).rejects.toMatchError(
        new GolemPaymentError(
          `Could not create new allocation. ${expectedPreviousError}`,
          PaymentErrorCode.AllocationCreationFailed,
          undefined,
          undefined,
          expectedPreviousError,
        ),
      );
    });

    it("should not create allocation with empty account parameters", async () => {
      const expectedPreviousError = new GolemConfigError("Account address and payment platform are required");
      await expect(Allocation.create(yagnaApi, { account: { address: "", platform: "" } })).rejects.toMatchError(
        new GolemPaymentError(
          `Could not create new allocation. ${expectedPreviousError}`,
          PaymentErrorCode.AllocationCreationFailed,
          undefined,
          undefined,
          expectedPreviousError,
        ),
      );
    });
  });
});
