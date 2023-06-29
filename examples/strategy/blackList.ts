import { TaskExecutor, Proposal, ProposalFilters } from "../../dist";
import { ProposalDTO } from "../../yajsapi/market";

const blackListIds = [
  "0x79bcfdc92af492c9b15ce9f690c3ccae53437179",
  "0x3c6a3f59518a0da1e75ea4351713bfe908e6642c",
  "0x1c1c0b14e321c258f7057e29533cba0081df8bb8",
];

const regexpFilter = async (proposal: ProposalDTO) => !proposal.provider.name.match(/golem*/);

(async function main() {
  const executor = await TaskExecutor.create({
    package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
    proposalFilter: regexpFilter,
  });
  await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
  await executor.end();
})();
