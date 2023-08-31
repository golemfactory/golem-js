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
        package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
        proposalFilter: ProposalFilters.blackListProposalRegexpFilter(/provider-2/),
        logger,
      });
      const data = ["one", "two", "three"];
      const results = executor.map<string, string | undefined>(data, async (ctx, x) => {
        const res = await ctx.run(`echo "${x}"`);
        return res.stdout?.toString().trim();
      });
      const finalOutputs: string[] = [];
      for await (const res of results) if (res) finalOutputs.push(res);
      expect(finalOutputs).toEqual(expect.arrayContaining(data));
      await logger.expectToInclude(`Proposal rejected by Proposal Filter`, 5000);
      await logger.expectToInclude(`Task 1 computed by provider provider-1`, 5000);
      await logger.expectToInclude(`Task 2 computed by provider provider-1`, 5000);
      await logger.expectToInclude(`Task 3 computed by provider provider-1`, 5000);
      await executor.end();
    });

    it("should filtered providers by white list names", async () => {
      const executor = await TaskExecutor.create({
        package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
        proposalFilter: ProposalFilters.whiteListProposalRegexpFilter(/provider-2/),
        logger,
      });
      const data = ["one", "two", "three"];
      const results = executor.map<string, string | undefined>(data, async (ctx, x) => {
        const res = await ctx.run(`echo "${x}"`);
        return res.stdout?.toString().trim();
      });
      const finalOutputs: string[] = [];
      for await (const res of results) if (res) finalOutputs.push(res);
      expect(finalOutputs).toEqual(expect.arrayContaining(data));
      await logger.expectToInclude(`Proposal rejected by Proposal Filter`, 5000);
      await logger.expectToInclude(`Task 1 computed by provider provider-2`, 5000);
      await logger.expectToInclude(`Task 2 computed by provider provider-2`, 5000);
      await logger.expectToInclude(`Task 3 computed by provider provider-2`, 5000);
      await executor.end();
    });
  });
  describe("Payments", () => {
    it("should only accept invoices below 0.00001 GLM", async () => {
      const executor = await TaskExecutor.create({
        package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
        invoiceFilter: PaymentFilters.acceptMaxAmountInvoiceFilter(0.00001),
        logger,
      });
      const data = ["one", "two"];
      const results = executor.map<string, string | undefined>(data, async (ctx, x) => {
        const res = await ctx.run(`echo "${x}"`);
        return res.stdout?.toString().trim();
      });
      const finalOutputs: string[] = [];
      for await (const res of results) if (res) finalOutputs.push(res);
      expect(finalOutputs).toEqual(expect.arrayContaining(data));
      await executor.end();
      await logger.expectToInclude(`Reason: Invoice rejected by Invoice Filter`, 100);
    });

    it("should only accept debit notes below 0.00001 GLM", async () => {
      const executor = await TaskExecutor.create({
        package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
        debitNotesFilter: PaymentFilters.acceptMaxAmountDebitNoteFilter(0.00001),
        logger,
      });
      const data = ["one", "two"];
      const results = executor.map<string, string | undefined>(data, async (ctx, x) => {
        const res = await ctx.run(`echo "${x}"`);
        return res.stdout?.toString().trim();
      });
      const finalOutputs: string[] = [];
      for await (const res of results) if (res) finalOutputs.push(res);
      expect(finalOutputs).toEqual(expect.arrayContaining(data));
      await executor.end();
      await logger.expectToInclude(`DebitNote rejected by DebitNote Filter`, 100);
    });
  });
});
