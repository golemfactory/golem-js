import { Allocation, GolemConfigError, YagnaApi } from "../../src";
import { anything, imock, instance, mock, reset, when } from "@johanblumenberg/ts-mockito";
import { PaymentApi } from "ya-ts-client";

const mockYagna = mock(YagnaApi);
const mockPayment = mock(PaymentApi.RequestorService);
const mockAllocation = imock<PaymentApi.AllocationDTO>();

describe("Allocation", () => {
  beforeEach(() => {
    reset(mockYagna);
    reset(mockPayment);
    reset(mockAllocation);

    when(mockYagna.payment).thenReturn(instance(mockPayment));

    when(mockPayment.createAllocation(anything())).thenResolve(instance(mockAllocation));
  });

  describe("Creating", () => {
    it("should create allocation", async () => {
      const allocation = new Allocation({
        address: "0xSomeAddress",
        paymentPlatform: "erc20-holesky-tglm",
        allocationId: "allocation-id",
        makeDeposit: false,
        remainingAmount: "1.0",
        spentAmount: "0.0",
        timestamp: "2024-01-01T00:00:00.000Z",
        totalAmount: "1.0",
      });
      expect(allocation).toBeInstanceOf(Allocation);
    });

    it("should not create allocation with empty account parameters", () => {
      expect(
        () =>
          new Allocation({
            address: "",
            paymentPlatform: "",
            allocationId: "allocation-id",
            makeDeposit: false,
            remainingAmount: "1.0",
            spentAmount: "0.0",
            timestamp: "2024-01-01T00:00:00.000Z",
            totalAmount: "1.0",
          }),
      ).toThrowError(new GolemConfigError("Account address and payment platform are required"));
    });
  });
});
