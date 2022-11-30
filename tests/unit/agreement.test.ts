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
  it("create agreement using factory", async () => {
    const agreement = await Agreement.create("test_proposal_id", { subnetTag, logger });
    expect(agreement).to.be.instanceof(Agreement);
    expect(agreement.id).to.be.lengthOf(64);
    expect(logger.logs).to.be.match(/Agreement .* created based on proposal test_proposal_id/);
  });

  it("created agreement have provider data", async () => {
    const agreement = await Agreement.create("test_proposal_id", { subnetTag, logger });
    expect(agreement).to.be.instanceof(Agreement);
    //@ts-ignore
    expect(agreement.provider.id).to.an("string");
    //@ts-ignore
    expect(agreement.provider.name).to.an("string");
  });

  it("terminate()", async () => {
    const agreement = await Agreement.create("test_proposal_id", { subnetTag, logger });
    await agreement.terminate();
    expect(logger.logs).to.be.match(/Agreement .* terminated/);
  });

  it("getState() should return correct state", async () => {
    const agreement = await Agreement.create("test_proposal_id", { subnetTag, logger });
    expect(await agreement.getState()).to.be.equal(AgreementStateEnum.Approved);
  });

  it("confirm() should confirm agreement", async () => {
    const agreement = await Agreement.create("test_proposal_id", { subnetTag, logger });
    await agreement.confirm();
    expect(logger.logs).to.be.match(/Agreement .* approved/);
  });
});
