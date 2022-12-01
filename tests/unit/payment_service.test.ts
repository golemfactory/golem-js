import rewiremock from "rewiremock";
import { PaymentApiMock } from "../mock/rest/payment";
rewiremock("ya-ts-client/dist/ya-payment/api").with({ RequestorApi: PaymentApiMock });
rewiremock.enable();
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
import { MarketService } from "../../yajsapi/market";
import { agreementPoolServiceMock, packageMock, marketStrategyAlwaysBan, LoggerMock, allocationMock } from "../mock";
import { proposalsInitial, proposalsDraft } from "../mock/fixtures";

const logger = new LoggerMock();

describe("Payment Service", () => {
  beforeEach(() => {
    logger.clear();
  });

  describe("Allocations", () => {
    it("should creating allocations for available accounts", async () => {
      // TODO
    });

    it("should not creating allocations if there are no available accounts", async () => {
      // TODO
    });

    it("should release all created allocations when service stopped", async () => {
      // TODO
    });
  });

  describe("Processing payments", () => {
    it("should accept and process payment for agreement", async () => {
      // TODO
    });
  });
});
