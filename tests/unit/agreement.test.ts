import chai from "chai";
import chaiUuid from "chai-uuid";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiUuid);
chai.use(chaiAsPromised);

const expect = chai.expect;

import rewiremock from "rewiremock";
import { RequestorApiMock } from "../mock/requestor_api";

rewiremock("ya-ts-client/dist/ya-market/api").with({
  RequestorApi: RequestorApiMock,
});
rewiremock.enable();

import {Agreement, AgreementState, AgreementFactory, ProposalForAgreementInterface} from "../../yajsapi/agreement";



describe("#Agreement()", () => {
  before(() => {
    process.env.YAGNA_APPKEY = "test";
    process.env.YAGNA_API_BASEPATH = "http://127.0.0.1:7465/market-api/v1";
  });

  it("create agreement", async () => {
    const factory = new AgreementFactory();
    const agreement = await factory.create(new TestProposal("test_proposal_id"));
    expect(agreement).to.be.instanceof(Agreement);
    expect(agreement.getId()).to.be.lengthOf(64);
  });
  //
  // it("create agreement without credentials", async () => {
  //   process.env.YAGNA_APPKEY = "";
  //   expect(async() => {
  //     const factory = new AgreementFactory();
  //     const agreement = await factory.create(new TestProposal("test_proposal_id"));
  //   }).to.throw(Error, "Api key not defined")
  //   process.env.YAGNA_APPKEY = "test";
  // });
  //
  // it("create activity without api base path", () => {
  //   process.env.YAGNA_API_BASEPATH = "";
  //   expect(async() => {
  //     const factory = new AgreementFactory();
  //     const agreement = await factory.create(new TestProposal("test_proposal_id"));
  //   }).to.throw(Error, "Api base path not defined");
  //   process.env.YAGNA_API_BASEPATH = "http://127.0.0.1:7465/activity-api/v1";
  // });
});





class TestProposal implements ProposalForAgreementInterface {
  constructor(public readonly id, private score = 0) {

  }

  getId(): string {
    return this.id;
  }

  getScore(): number {
    return this.score;
  }

  getValidTo(): string {
    return (new Date(Date.now() + 3000).toISOString()).toString();
  }
}