import { LoggerMock, YagnaMock } from "../mock";
import { Allocation } from "../../src/payment";

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

    it("should not create allocation with empty account parameters", async () => {
      await expect(Allocation.create(yagnaApi, { account: { address: "", platform: "" } })).rejects.toThrow(
        "Account address and payment platform are required",
      );
    });
  });
});
