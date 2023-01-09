import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
import { LoggerMock } from "../mock";
import { Agreement, AgreementPoolService } from "../../yajsapi/agreement";

const logger = new LoggerMock();
process.env["YAGNA_APPKEY"] = "test_key";

describe("Agreement Pool Service", () => {
  beforeEach(() => {
    logger.clear();
  });

  describe("run()", () => {
    it("should start service", async () => {
      const agreementService = new AgreementPoolService({ logger });
      await agreementService.run();
      expect(logger.logs).to.include("Agreement Pool Service has started");
      await agreementService.end();
    });
    it("what should do if service is running already?");
  });
  describe("end()", () => {
    it("should stop service", async () => {
      const agreementService = new AgreementPoolService({ logger });
      await agreementService.run();
      await agreementService.end();
      expect(logger.logs).to.include("Agreement Pool Service has been stopped");
    });
    it("what should do if service is not running anymore?");
  });

  describe("getAvailableAgreement()", () => {
    it("should create and return agreement from available proposal pool", async () => {
      const agreementService = new AgreementPoolService({ logger });
      await agreementService.run();
      await agreementService.addProposal("proposal_id");
      const agreement = await agreementService.getAgreement();
      expect(agreement).to.be.instanceof(Agreement);
    }).timeout(5000);

    it("should return agreement if is available in the pool", async () => {
      const agreementService = new AgreementPoolService({ logger });
      await agreementService.run();
      await agreementService.addProposal("proposal_id");
      const agreement1 = await agreementService.getAgreement();
      await agreementService.releaseAgreement(agreement1.id, true);
      const agreement2 = await agreementService.getAgreement();
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
      const agreementService = new AgreementPoolService({ logger });
      await agreementService.run();
      await agreementService.addProposal("proposal_id");
      const agreement = await agreementService.getAgreement();
      await agreementService.releaseAgreement(agreement.id, true);
      expect(logger.logs).to.include(`Agreement ${agreement.id} has been released for reuse`);
    }).timeout(5000);

    it("should terminate agreement if flag reuse if off", async () => {
      const agreementService = new AgreementPoolService({ logger });
      await agreementService.run();
      await agreementService.addProposal("proposal_id");
      const agreement = await agreementService.getAgreement();
      await agreementService.releaseAgreement(agreement.id, false);
      expect(logger.logs).to.include(`Agreement ${agreement.id} has been released and terminated`);
    }).timeout(5000);

    it("should throw an exception if there is no agreement with given id", async () => {
      const agreementService = new AgreementPoolService({ logger });
      await agreementService.run();
      await agreementService.addProposal("proposal_id");
      const agreement = await agreementService.getAgreement();
      await expect(agreementService.releaseAgreement("not-known-id", false)).to.be.rejectedWith(
        `Agreement not-known-id cannot found in pool`
      );
    }).timeout(5000);

    it("should throw an exception if there is no agreement with given id", async () => {
      const agreementService = new AgreementPoolService({ logger });
      await agreementService.run();
      await agreementService.addProposal("proposal_id");
      const agreement = await agreementService.getAgreement();
      await expect(agreementService.releaseAgreement("not-known-id", false)).to.be.rejectedWith(
        `Agreement not-known-id cannot found in pool`
      );
    }).timeout(5000);
  });

  describe("addProposal()", () => {
    it("should add proposal to pool", async () => {
      const agreementService = new AgreementPoolService({ logger });
      await agreementService.run();

      await agreementService.addProposal("proposal_id");
      expect(logger.logs).to.match(/New offer proposal added to pool .*/);

      await agreementService.end();
    });
  });
});
