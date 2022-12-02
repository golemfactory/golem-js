import rewiremock from "rewiremock";
import { PaymentApiMock } from "../mock/rest/payment";
rewiremock("ya-ts-client/dist/ya-payment/api").with({ RequestorApi: PaymentApiMock });
rewiremock.enable();
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const expect = chai.expect;
import { LoggerMock } from "../mock";
import { Allocation } from "../../yajsapi/payment/allocation";

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
