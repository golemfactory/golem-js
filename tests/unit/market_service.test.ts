import { setExpectedProposals } from "../mock/rest/market";
import { MarketService, ProposalFilters } from "../../src/market";
import { agreementPoolServiceMock, packageMock, LoggerMock, allocationMock, YagnaMock } from "../mock";
import {
  proposalsInitial,
  proposalsDraft,
  proposalsWrongPaymentPlatform,
  proposalsShortDebitNoteTimeout,
} from "../mock/fixtures";

const logger = new LoggerMock();
const yagnaApi = new YagnaMock().getApi();

describe("Market Service", () => {
  beforeEach(() => {
    logger.clear();
  });

  it("should start service and publish demand", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, yagnaApi, { logger });
    await marketService.run(packageMock, allocationMock);
    expect(logger.logs).toContain("Market Service has started");
    expect(logger.logs).toContain("Demand published on the market");
    await marketService.end();
    expect(logger.logs).toContain("Market Service has been stopped");
  });

  it("should respond initial proposal", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, yagnaApi, { logger });
    await marketService.run(packageMock, allocationMock);
    setExpectedProposals(proposalsInitial);
    await logger.expectToInclude("Proposal has been responded", 10);
    await marketService.end();
  });

  it("should add draft proposal to agreement pool", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, yagnaApi, { logger });
    await marketService.run(packageMock, allocationMock);
    setExpectedProposals(proposalsDraft);
    await logger.expectToInclude("Proposal has been confirmed", 10);
    const addedProposalsIds = agreementPoolServiceMock["getProposals"]().map((p) => p.id);
    expect(addedProposalsIds).toEqual(expect.arrayContaining(proposalsDraft.map((p) => p.proposal.proposalId)));
    await marketService.end();
  });

  it("should reject initial proposal without common payment platform", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, yagnaApi, { logger });
    await marketService.run(packageMock, allocationMock);
    setExpectedProposals([proposalsInitial[6]]);
    await logger.expectToMatch(/Proposal has been rejected .* Reason: No common payment platform/, 10);
    await marketService.end();
  });

  it("should reject when no common payment platform", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, yagnaApi, { logger });
    await marketService.run(packageMock, allocationMock);
    setExpectedProposals(proposalsWrongPaymentPlatform);
    await logger.expectToMatch(/No common payment platform/, 10);
    await marketService.end();
  });
  it("should reject initial proposal when debit note acceptance timeout too short", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, yagnaApi, { logger });
    await marketService.run(packageMock, allocationMock);
    setExpectedProposals(proposalsShortDebitNoteTimeout);
    await logger.expectToMatch(/Debit note acceptance timeout too short/, 10);
    await marketService.end();
  });
  it("should reject when proposal rejected by Proposal Filter", async () => {
    const proposalAlwaysBanFilter = () => Promise.resolve(false);
    const marketService = new MarketService(agreementPoolServiceMock, yagnaApi, {
      logger,
      proposalFilter: proposalAlwaysBanFilter,
    });
    await marketService.run(packageMock, allocationMock);
    setExpectedProposals(proposalsInitial);
    await logger.expectToMatch(/Proposal rejected by Proposal Filter/, 10);
    await marketService.end();
  });
  it("should reject when proposal rejected by BlackListIds Proposal Filter", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, yagnaApi, {
      logger,
      proposalFilter: ProposalFilters.blackListProposalIdsFilter(["0xee8993fe1dcff6b131d3fd759c6b3ddcb82d1655"]),
    });
    await marketService.run(packageMock, allocationMock);
    setExpectedProposals(proposalsInitial);
    await logger.expectToMatch(/Proposal rejected by Proposal Filter/, 10);
    await marketService.end();
  });
  it("should reject when proposal rejected by BlackListNames Proposal Filter", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, yagnaApi, {
      logger,
      proposalFilter: ProposalFilters.blackListProposalRegexpFilter(/golem2004/),
    });
    await marketService.run(packageMock, allocationMock);
    setExpectedProposals(proposalsInitial);
    await logger.expectToMatch(/Proposal rejected by Proposal Filter/, 10);
    await marketService.end();
  });
  it("should reject when proposal rejected by WhiteListIds Proposal Filter", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, yagnaApi, {
      logger,
      proposalFilter: ProposalFilters.whiteListProposalIdsFilter(["0x123455"]),
    });
    await marketService.run(packageMock, allocationMock);
    setExpectedProposals(proposalsInitial);
    await logger.expectToMatch(/Proposal rejected by Proposal Filter/, 10);
    await marketService.end();
  });
  it("should reject when proposal rejected by WhiteListNames Proposal Filter", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, yagnaApi, {
      logger,
      proposalFilter: ProposalFilters.whiteListProposalRegexpFilter(/abcdefg/),
    });
    await marketService.run(packageMock, allocationMock);
    setExpectedProposals(proposalsInitial);
    await logger.expectToMatch(/Proposal rejected by Proposal Filter/, 10);
    await marketService.end();
  });
  it("should respond when provider id is whitelisted by WhiteListIds Proposal Filter", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, yagnaApi, {
      logger,
      proposalFilter: ProposalFilters.whiteListProposalIdsFilter(["0xee8993fe1dcff6b131d3fd759c6b3ddcb82d1655"]),
    });
    await marketService.run(packageMock, allocationMock);
    setExpectedProposals(proposalsInitial);
    await logger.expectToMatch(/Proposal has been responded/, 10);
    await marketService.end();
  });
  it("should respond when provider name is whitelisted by WhiteListNames Proposal Filter", async () => {
    const marketService = new MarketService(agreementPoolServiceMock, yagnaApi, {
      logger,
      proposalFilter: ProposalFilters.whiteListProposalRegexpFilter(/golem2004/),
    });
    await marketService.run(packageMock, allocationMock);
    setExpectedProposals(proposalsInitial);
    await logger.expectToMatch(/Proposal has been responded/, 10);
    await marketService.end();
  });
});
