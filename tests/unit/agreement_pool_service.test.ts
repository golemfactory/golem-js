import rewiremock from "rewiremock";
import { MarketApiMock, setExpectedProposals } from "../mock/market_api";
rewiremock("ya-ts-client/dist/ya-market/api").with({ RequestorApi: MarketApiMock });
rewiremock.enable();
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
import { LoggerMock } from "../mock/logger";
import { paymentServiceMock, agreementPoolServiceMock, packageMock, marketStrategyAlwaysBan } from "../mock";
import { AgreementPoolService } from "../../yajsapi/agreement";

const logger = new LoggerMock();

describe("Agreement Pool Service", () => {
  beforeEach(() => {
    logger.clear();
  });

  describe("run()", () => {
    it("should start service", async () => {
      const marketService = new AgreementPoolService({ logger });
      await marketService.run();
      expect(logger.logs).to.include("Agreement Pool Service has started");
      await marketService.end();
    });
    it("what should do if service is running already?");
  });
  describe("end()", () => {
    it("should stop service", async () => {
      const marketService = new AgreementPoolService({ logger });
      await marketService.run();
      await marketService.end();
      expect(logger.logs).to.include("Agreement Pool Service has been stopped");
    });
    it("what should do if service is not running anymore?");
  });

  describe("getAvailableAgreement()", () => {
    it("should create and return agreement from available proposal pool", async () => {
      const marketService = new AgreementPoolService({ logger });
      await marketService.run();

      await marketService.addProposal("proposal_id");
    });
    it("should return agreement if is available in the pool");
    it("should not create agreement from proposal if any agreement is available");
  });

  describe("isProviderLastAgreementRejected()");

  describe("terminateAll()");

  describe("addProposal()", () => {
    it("should add proposal to pool", async () => {
      const marketService = new AgreementPoolService({ logger });
      await marketService.run();

      await marketService.addProposal("proposal_id");
      expect(logger.logs).to.match(/New offer proposal added to pool .*/);

      await marketService.end();
    });
  });
});
