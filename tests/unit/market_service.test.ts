import { setExpectedProposals } from "../mock/rest/market.js";
import { expect } from "chai";
import { MarketService, ProposalFilters } from "../../yajsapi/market/index.js";
import { agreementPoolServiceMock, packageMock, LoggerMock, allocationMock } from "../mock/index.js";
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
  it("should reject when proposal rejected by Proposal Filter", async () => {
    const proposalAlwaysBanFilter = () => Promise.resolve(false);
    const marketService = new MarketService(agreementPoolServiceMock, {
      logger,
      proposalFilter: proposalAlwaysBanFilter,
    });
    await marketService.run(packageMock, [allocationMock]);
    setExpectedProposals(proposalsInitial);
    await logger.expectToMatch(/Proposal rejected by Proposal Filter/, 10);
    await marketService.end();
  });
  it("should reject when proposal rejected by BlackListIds Proposal Filter", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, {
      logger,
      proposalFilter: ProposalFilters.blackListProposalIdsFilter(["0xee8993fe1dcff6b131d3fd759c6b3ddcb82d1655"]),
    });
    await marketService.run(packageMock, [allocationMock]);
    setExpectedProposals(proposalsInitial);
    await logger.expectToMatch(/Proposal rejected by Proposal Filter/, 10);
    await marketService.end();
  });
  it("should reject when proposal rejected by BlackListNames Proposal Filter", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, {
      logger,
      proposalFilter: ProposalFilters.blackListProposalRegexpFilter(/golem2004/),
    });
    await marketService.run(packageMock, [allocationMock]);
    setExpectedProposals(proposalsInitial);
    await logger.expectToMatch(/Proposal rejected by Proposal Filter/, 10);
    await marketService.end();
  });
  it("should reject when proposal rejected by WhiteListIds Proposal Filter", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, {
      logger,
      proposalFilter: ProposalFilters.whiteListProposalIdsFilter(["0x123455"]),
    });
    await marketService.run(packageMock, [allocationMock]);
    setExpectedProposals(proposalsInitial);
    await logger.expectToMatch(/Proposal rejected by Proposal Filter/, 10);
    await marketService.end();
  });
  it("should reject when proposal rejected by WhiteListNames Proposal Filter", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, {
      logger,
      proposalFilter: ProposalFilters.whiteListProposalRegexpFilter(/abcdefg/),
    });
    await marketService.run(packageMock, [allocationMock]);
    setExpectedProposals(proposalsInitial);
    await logger.expectToMatch(/Proposal rejected by Proposal Filter/, 10);
    await marketService.end();
  });
  it("should respond when provider id is whitelisted by WhiteListIds Proposal Filter", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, {
      logger,
      proposalFilter: ProposalFilters.whiteListProposalIdsFilter(["0xee8993fe1dcff6b131d3fd759c6b3ddcb82d1655"]),
    });
    await marketService.run(packageMock, [allocationMock]);
    setExpectedProposals(proposalsInitial);
    await logger.expectToMatch(/Proposal has been responded/, 10);
    await marketService.end();
  });
  it("should respond when provider name is whitelisted by WhiteListNames Proposal Filter", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, {
      logger,
      proposalFilter: ProposalFilters.whiteListProposalRegexpFilter(/golem2004/),
    });
    await marketService.run(packageMock, [allocationMock]);
    setExpectedProposals(proposalsInitial);
    await logger.expectToMatch(/Proposal has been responded/, 10);
    await marketService.end();
  });
});
