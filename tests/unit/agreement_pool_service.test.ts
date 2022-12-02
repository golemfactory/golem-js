import rewiremock from "rewiremock";
import { MarketApiMock, setExpectedProposals } from "../mock/market_api";
rewiremock("ya-ts-client/dist/ya-market/api").with({ RequestorApi: MarketApiMock });
rewiremock.enable();
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
import { LoggerMock } from "../mock/logger";
import { Agreement, AgreementPoolService } from "../../yajsapi/agreement";

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
      const agreement = await marketService.getAgreement();
      expect(agreement).to.be.instanceof(Agreement);
    }).timeout(5000);

    it("should return agreement if is available in the pool", async () => {
      const marketService = new AgreementPoolService({ logger });
      await marketService.run();
      await marketService.addProposal("proposal_id");
      const agreement1 = await marketService.getAgreement();
      await marketService.releaseAgreement(agreement1.id, true);
      const agreement2 = await marketService.getAgreement();
      expect(agreement1).to.deep.equal(agreement2);
    }).timeout(5000);
    it("should not create agreement from proposal if any agreement is available");
  });

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  describe("isProviderLastAgreementRejected()", () => {});

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  describe("terminateAll()", () => {});

  describe("releaseAgreement()", () => {
    it("should return agreement to the pool if flag reuse if on", async () => {
      const marketService = new AgreementPoolService({ logger });
      await marketService.run();
      await marketService.addProposal("proposal_id");
      const agreement = await marketService.getAgreement();
      await marketService.releaseAgreement(agreement.id, true);
      expect(logger.logs).to.include(`Agreement ${agreement.id} has been released for reuse`);
    }).timeout(5000);

    it("should terminate agreement if flag reuse if off", async () => {
      const marketService = new AgreementPoolService({ logger });
      await marketService.run();
      await marketService.addProposal("proposal_id");
      const agreement = await marketService.getAgreement();
      await marketService.releaseAgreement(agreement.id, false);
      expect(logger.logs).to.include(`Agreement ${agreement.id} has been released and terminated`);
    }).timeout(5000);

    it("should throw an exception if there is no agreement with given id", async () => {
      const marketService = new AgreementPoolService({ logger });
      await marketService.run();
      await marketService.addProposal("proposal_id");
      const agreement = await marketService.getAgreement();
      await expect(marketService.releaseAgreement("not-known-id", false)).to.be.rejectedWith(
        `Agreement not-known-id cannot found in pool`
      );
    }).timeout(5000);

    it("should throw an exception if there is no agreement with given id", async () => {
      const marketService = new AgreementPoolService({ logger });
      await marketService.run();
      await marketService.addProposal("proposal_id");
      const agreement = await marketService.getAgreement();
      await expect(marketService.releaseAgreement("not-known-id", false)).to.be.rejectedWith(
        `Agreement not-known-id cannot found in pool`
      );
    }).timeout(5000);
  });

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
