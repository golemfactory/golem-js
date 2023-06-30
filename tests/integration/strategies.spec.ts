import { expect } from "chai";
import { TaskExecutor, ProposalFilters, PaymentFilters } from "../../yajsapi/index.js";
import { LoggerMock } from "../mock/index.js";

const logger = new LoggerMock(false);

describe("Strategies", function () {
  let executor: TaskExecutor;
  afterEach(async function () {
    this.timeout(60000);
    await executor.end();
  });
  describe("Proposals", () => {
    it("should filtered providers by black list names", async () => {
      executor = await TaskExecutor.create({
        package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
        payment: { network: "rinkeby" },
        proposalFilter: ProposalFilters.BlackListProposalNamesFilter(/provider-2/),
        logger,
      });
      const data = ["one", "two", "three"];
      const results = executor.map<string, string>(data, async (ctx, x) => {
        const res = await ctx.run(`echo "${x}"`);
        return res.stdout?.trim();
      });
      const finalOutputs: string[] = [];
      for await (const res of results) if (res) finalOutputs.push(res);
      expect(finalOutputs).to.have.members(data);
      await logger.expectToInclude(`Proposal rejected by Proposal Filter`, 5000);
      await logger.expectToInclude(`Task 1 computed by provider provider-1`, 5000);
      await logger.expectToInclude(`Task 2 computed by provider provider-1`, 5000);
      await logger.expectToInclude(`Task 3 computed by provider provider-1`, 5000);
    }).timeout(80000);

    it("should filtered providers by white list names", async () => {
      executor = await TaskExecutor.create({
        package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
        payment: { network: "rinkeby" },
        proposalFilter: ProposalFilters.WhiteListProposalNamesFilter(/provider-1/),
        logger,
      });
      const data = ["one", "two", "three"];
      const results = executor.map<string, string>(data, async (ctx, x) => {
        const res = await ctx.run(`echo "${x}"`);
        return res.stdout?.trim();
      });
      const finalOutputs: string[] = [];
      for await (const res of results) if (res) finalOutputs.push(res);
      expect(finalOutputs).to.have.members(data);
      await logger.expectToInclude(`Proposal rejected by Proposal Filter`, 5000);
      await logger.expectToInclude(`Task 1 computed by provider provider-1`, 5000);
      await logger.expectToInclude(`Task 2 computed by provider provider-1`, 5000);
      await logger.expectToInclude(`Task 3 computed by provider provider-1`, 5000);
    }).timeout(80000);
  });
  describe("Payments", () => {
    // tood
  });
});
