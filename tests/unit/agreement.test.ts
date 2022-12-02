/* eslint @typescript-eslint/ban-ts-comment: 0 */
import rewiremock from "rewiremock";
import { MarketApiMock } from "../mock/market_api";
rewiremock("ya-ts-client/dist/ya-market/api").with({ RequestorApi: MarketApiMock });
rewiremock.enable();
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const expect = chai.expect;
import { LoggerMock } from "../mock";
import { Agreement } from "../../yajsapi/agreement";
import { AgreementStateEnum } from "ya-ts-client/dist/ya-market/src/models/agreement";

const subnetTag = "testnet";
const logger = new LoggerMock();

describe("Agreement", () => {
  describe("create()", () => {
    it("should create agreement for given proposal Id", async () => {
      const agreement = await Agreement.create("test_proposal_id", { subnetTag, logger });
      expect(agreement).to.be.instanceof(Agreement);
      expect(agreement.id).to.be.lengthOf(64);
      expect(logger.logs).to.be.match(/Agreement .* created based on proposal test_proposal_id/);
    });
  });

  describe("provider", () => {
    it("should be a instance ProviderInfo with provider details", async () => {
      const agreement = await Agreement.create("test_proposal_id", { subnetTag, logger });
      expect(agreement).to.be.instanceof(Agreement);
      //@ts-ignore
      expect(agreement.provider.id).to.an("string");
      //@ts-ignore
      expect(agreement.provider.name).to.an("string");
    });
  });

  describe("getState()", () => {
    it("should return state of agreement", async () => {
      const agreement = await Agreement.create("test_proposal_id", { subnetTag, logger });
      expect(await agreement.getState()).to.be.equal(AgreementStateEnum.Approved);
    });
    it("should throw en error if there is no state");
  });

  describe("terminate()", () => {
    it("should terminate agreement", async () => {
      const agreement = await Agreement.create("test_proposal_id", { subnetTag, logger });
      await agreement.terminate();
      expect(logger.logs).to.be.match(/Agreement .* terminated/);
    });
  });

  describe("confirm()", () => {
    it("should confirm agreement", async () => {
      const agreement = await Agreement.create("test_proposal_id", { subnetTag, logger });
      await agreement.confirm();
      expect(logger.logs).to.be.match(/Agreement .* approved/);
    });
  });
});
