import { TaskExecutor, ProposalFilters, PaymentFilters } from "../../src";
import { LoggerMock } from "../mock";

const logger = new LoggerMock(false);

describe("Strategies", function () {
  beforeEach(function () {
    logger.clear();
  });
  describe("Proposals", () => {
    it("should filtered providers by black list names", async () => {
      const executor = await TaskExecutor.create({
        package: "golem/alpine:latest",
        proposalFilter: ProposalFilters.blackListProposalRegexpFilter(/provider-2/),
        logger,
      });
      const data = ["one", "two", "three"];
      const futureResults = data.map((x) =>
        executor.run(async (ctx) => {
          const res = await ctx.run(`echo "${x}"`);
          return res.stdout?.toString().trim();
        }),
      );
      const finalOutputs = (await Promise.all(futureResults)).filter((x) => !!x);
      expect(finalOutputs).toEqual(expect.arrayContaining(data));
      await logger.expectToMatch(/Proposal rejected by Proposal Filter/, 5000);
      await logger.expectToInclude(`Task computed`, { providerName: "provider-1", id: 1 }, 5000);
      await logger.expectToInclude(`Task computed`, { providerName: "provider-1", id: 2 }, 5000);
      await logger.expectToInclude(`Task computed`, { providerName: "provider-1", id: 3 }, 5000);
      await executor.shutdown();
    });

    it("should filtered providers by white list names", async () => {
      const executor = await TaskExecutor.create({
        package: "golem/alpine:latest",
        proposalFilter: ProposalFilters.whiteListProposalRegexpFilter(/provider-2/),
        logger,
      });
      const data = ["one", "two", "three"];
      const futureResults = data.map((x) =>
        executor.run(async (ctx) => {
          const res = await ctx.run(`echo "${x}"`);
          return res.stdout?.toString().trim();
        }),
      );
      const finalOutputs = (await Promise.all(futureResults)).filter((x) => !!x);
      expect(finalOutputs).toEqual(expect.arrayContaining(data));
      await logger.expectToInclude(`Proposal rejected by Proposal Filter`, expect.anything(), 5000);
      await logger.expectToInclude(`Task computed`, { providerName: `provider-2`, id: "1" }, 5000);
      await logger.expectToInclude(`Task computed`, { providerName: `provider-2`, id: "2" }, 5000);
      await logger.expectToInclude(`Task computed`, { providerName: `provider-2`, id: "3" }, 5000);
      await executor.shutdown();
    });
  });
});
