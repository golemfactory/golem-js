import { LoggerMock } from "../mock";
import { Allocation } from "../../src/payment";

const logger = new LoggerMock();
const account = { address: "test_address", platform: "test_platform" };

describe("Allocation", () => {
  beforeEach(() => logger.clear());

  describe("Creating", () => {
    it("should create allocation", async () => {
      const allocation = await Allocation.create({ account });
      expect(allocation).toBeInstanceOf(Allocation);
    });

    it("should not create allocation with empty account parameters", async () => {
      await expect(Allocation.create({ account: { address: "", platform: "" } })).rejects.toThrow(
        "Account address and payment platform are required",
      );
    });
  });
});
