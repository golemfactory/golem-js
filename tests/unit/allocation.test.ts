import { Allocation, GolemConfigError, GolemPaymentError, PaymentErrorCode, YagnaApi } from "../../src";
import { AllocationOptions } from "../../src/payment/allocation";
import { LoggerMock } from "../mock/utils/logger";
import { anything, imock, instance, mock, reset, when } from "@johanblumenberg/ts-mockito";
import { PaymentApi } from "ya-ts-client";

const logger = new LoggerMock();
const account = { address: "test_address", platform: "test_platform" };

const mockYagna = mock(YagnaApi);
const mockPayment = mock(PaymentApi.RequestorService);
const mockAllocation = imock<PaymentApi.AllocationDTO>();

describe("Allocation", () => {
  beforeEach(() => {
    logger.clear();

    reset(mockYagna);
    reset(mockPayment);
    reset(mockAllocation);

    when(mockYagna.payment).thenReturn(instance(mockPayment));

    when(mockPayment.createAllocation(anything())).thenResolve(instance(mockAllocation));
  });

  describe("Creating", () => {
    it("should create allocation", async () => {
      const allocation = await Allocation.create(instance(mockYagna), { account });
      expect(allocation).toBeInstanceOf(Allocation);
    });

    it("should not create allocation without account options", async () => {
      const expectedPreviousError = new GolemConfigError("Account option is required");
      await expect(Allocation.create(instance(mockYagna), {} as AllocationOptions)).rejects.toMatchError(
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
      await expect(
        Allocation.create(instance(mockYagna), { account: { address: "", platform: "" } }),
      ).rejects.toMatchError(
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
