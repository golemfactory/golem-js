import rewiremock from "rewiremock";
import { MarketApiMock } from "../mock/market_api";
rewiremock("ya-ts-client/dist/ya-market/api").with({ RequestorApi: MarketApiMock });
rewiremock.enable();
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
import { LoggerMock } from "../mock/logger";
import { MarketService } from "../../yajsapi/market";
import { paymentServiceMock, agreementPoolServiceMock, packageMock, marketStrategyAlwaysBan } from "../mock";
import { proposalsInitial, proposalsDraft } from "../mock/fixtures/proposals";

const logger = new LoggerMock();

describe("Market Service", () => {
  beforeEach(() => {
    logger.clear();
  });

  it("should start service and publish demand", async () => {
    const marketService = new MarketService(paymentServiceMock, agreementPoolServiceMock, logger);
    await marketService.run(packageMock);
    expect(logger.logs).to.include("Market Service has started");
    expect(logger.logs).to.match(/Demand .* published on the market/);
    await marketService.end();
    expect(logger.logs).to.include("Market Service has been stopped");
  });

  it("should respond initial proposal", async () => {
    const marketService = new MarketService(paymentServiceMock, agreementPoolServiceMock, logger);
    await marketService.run(packageMock);
    marketService["demand"]?.["api"]["setExpectedProposals"](proposalsInitial);
    await logger.expectToInclude("Proposal hes been responded", 10);
    await marketService.end();
  });

  it("should add draft proposal to agreement pool", async () => {
    const marketService = new MarketService(paymentServiceMock, agreementPoolServiceMock, logger);
    await marketService.run(packageMock);
    marketService["demand"]?.["api"]["setExpectedProposals"](proposalsDraft);
    await logger.expectToInclude("Proposal has been confirmed", 10);
    const addedProposalsIds = agreementPoolServiceMock["getProposalIds"]();
    expect(addedProposalsIds).to.deep.equal(proposalsDraft.map((p) => p.proposal.proposalId));
    await marketService.end();
  });

  it("should reject initial proposal without common payment platform", async () => {
    const marketService = new MarketService(paymentServiceMock, agreementPoolServiceMock, logger);
    await marketService.run(packageMock);
    marketService["demand"]?.["api"]["setExpectedProposals"]([proposalsInitial[6]]);
    await logger.expectToMatch(/Proposal hes been rejected .* Reason: No common payment platform/, 10);
    await marketService.end();
  });

  it("should reject initial proposal with to low score", async () => {
    const marketService = new MarketService(
      paymentServiceMock,
      agreementPoolServiceMock,
      logger,
      undefined,
      marketStrategyAlwaysBan
    );
    await marketService.run(packageMock);
    marketService["demand"]?.["api"]["setExpectedProposals"](proposalsInitial);
    await logger.expectToMatch(/Proposal hes been rejected .* Reason: Score is to low/, 10);
    await marketService.end();
  }).timeout(10000);
});
