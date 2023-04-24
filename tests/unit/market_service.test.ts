import { setExpectedProposals } from "../mock/rest/market.js";
import { expect } from "chai";
import { MarketService } from "../../yajsapi/market/index.js";
import {
  agreementPoolServiceMock,
  packageMock,
  marketStrategyAlwaysBan,
  LoggerMock,
  allocationMock,
} from "../mock/index.js";
import {
  proposalsInitial,
  proposalsDraft,
  proposalsWrongPaymentPlatform,
  proposalsShortDebitNoteTimeout,
} from "../mock/fixtures/index.js";

const logger = new LoggerMock();

describe("Market Service", () => {
  beforeEach(() => {
    logger.clear();
  });

  it("should start service and publish demand", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, { logger });
    await marketService.run(packageMock, [allocationMock]);
    expect(logger.logs).to.include("Market Service has started");
    expect(logger.logs).to.include("Demand published on the market");
    await marketService.end();
    expect(logger.logs).to.include("Market Service has been stopped");
  });

  it("should respond initial proposal", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, { logger });
    await marketService.run(packageMock, [allocationMock]);
    setExpectedProposals(proposalsInitial);
    await logger.expectToInclude("Proposal has been responded", 10);
    await marketService.end();
  });

  it("should add draft proposal to agreement pool", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, { logger });
    await marketService.run(packageMock, [allocationMock]);
    setExpectedProposals(proposalsDraft);
    await logger.expectToInclude("Proposal has been confirmed", 10);
    const addedProposalsIds = agreementPoolServiceMock["getProposals"]().map((p) => p.id);
    expect(addedProposalsIds).to.eql(proposalsDraft.map((p) => p.proposal.proposalId));
    await marketService.end();
  });

  it("should reject initial proposal without common payment platform", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, { logger });
    await marketService.run(packageMock, [allocationMock]);
    setExpectedProposals([proposalsInitial[6]]);
    await logger.expectToMatch(/Proposal has been rejected .* Reason: No common payment platform/, 10);
    await marketService.end();
  });

  it("should reject when no common payment platform", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, { logger });
    await marketService.run(packageMock, [allocationMock]);
    setExpectedProposals(proposalsWrongPaymentPlatform);
    await logger.expectToMatch(/No common payment platform/, 10);
    await marketService.end();
  });
  it("should reject initial proposal when debit note acceptance timeout too short", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, { logger });
    await marketService.run(packageMock, [allocationMock]);
    setExpectedProposals(proposalsShortDebitNoteTimeout);
    await logger.expectToMatch(/Debit note acceptance timeout too short/, 10);
    await marketService.end();
  });
  it("should reject when proposal rejected by Market Strategy", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, { logger, strategy: marketStrategyAlwaysBan });
    await marketService.run(packageMock, [allocationMock]);
    setExpectedProposals(proposalsInitial);
    await logger.expectToMatch(/Proposal rejected by Market Strategy/, 10);
    await marketService.end();
  });
});
