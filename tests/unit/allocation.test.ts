import { expect } from "chai";
import { LoggerMock } from "../mock/index.js";
import { Allocation } from "../../yajsapi/payment/index.js";

const logger = new LoggerMock();
const account = { address: "test_address", platform: "test_platform" };

describe("Allocation", () => {
  beforeEach(() => logger.clear());

  describe("Creating", () => {
    it("should create allocation", async () => {
      const allocation = await Allocation.create({ account });
      expect(allocation).to.be.instanceof(Allocation);
    });

    it("should not create allocation with empty account parameters", async () => {
      await expect(Allocation.create({ account: { address: "", platform: "" } })).to.be.rejectedWith(
        "Account address and payment platform are required"
      );
    });
  });
});
