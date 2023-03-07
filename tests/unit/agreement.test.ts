import { expect } from "chai";
import { LoggerMock } from "../mock/index.js";
import { Agreement } from "../../yajsapi/index.js";
import { AgreementStateEnum } from "ya-ts-client/dist/ya-market/src/models/agreement.js";

const logger = new LoggerMock();

describe("Agreement", () => {
  beforeEach(() => logger.clear());
  describe("create()", () => {
    it("should create agreement for given proposal Id", async () => {
      const agreement = await Agreement.create("test_proposal_id", { logger });
      expect(agreement).to.be.instanceof(Agreement);
      expect(agreement.id).to.be.lengthOf(64);
      expect(logger.logs).to.be.match(/Agreement .* created/);
    });
  });

  describe("provider", () => {
    it("should be a instance ProviderInfo with provider details", async () => {
      const agreement = await Agreement.create("test_proposal_id", { logger });
      expect(agreement).to.be.instanceof(Agreement);
      expect(agreement.provider.id).to.an("string");
      expect(agreement.provider.name).to.an("string");
    });
  });

  describe("getState()", () => {
    it("should return state of agreement", async () => {
      const agreement = await Agreement.create("test_proposal_id", { logger });
      expect(await agreement.getState()).to.be.equal(AgreementStateEnum.Approved);
    });
  });

  describe("terminate()", () => {
    it("should terminate agreement", async () => {
      const agreement = await Agreement.create("test_proposal_id", { logger });
      await agreement.terminate();
      expect(logger.logs).to.be.match(/Agreement .* terminated/);
    });
  });

  describe("confirm()", () => {
    it("should confirm agreement", async () => {
      const agreement = await Agreement.create("test_proposal_id", { logger });
      await agreement.confirm();
      expect(logger.logs).to.be.match(/Agreement .* approved/);
    });
  });
});
