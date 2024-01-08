import { ProposalsBatch } from "./proposals_batch";
import { mock, instance, when } from "@johanblumenberg/ts-mockito";
import { Proposal } from "./proposal";

describe("ProposalsBatch", () => {
  describe("Adding Proposals", () => {
    it("should add the proposal to the batch from the new provider", async () => {
      const mockedProposal = mock(Proposal);
      when(mockedProposal.issuerId).thenReturn("provider1");
      const proposal = instance(mockedProposal);
      const proposalsBatch = new ProposalsBatch();
      proposalsBatch.addProposal(proposal);
      expect(proposalsBatch.getProposals()).toContainEqual(proposal);
    });
    it("should add the proposal to the batch from the existing provider", async () => {
      const proposalsBatch = new ProposalsBatch();
      const mockedProposal1 = mock(Proposal);
      when(mockedProposal1.issuerId).thenReturn("provider1");
      const mockedProposal2 = mock(Proposal);
      when(mockedProposal2.issuerId).thenReturn("provider1");
      when(mockedProposal2.pricing).thenReturn({
        cpuSec: 2,
        envSec: 3,
        start: 1,
      });
      const proposal1 = instance(mockedProposal1);
      const proposal2 = instance(mockedProposal1);
      proposalsBatch.addProposal(proposal1);
      proposalsBatch.addProposal(proposal2);
      expect(proposalsBatch.getProposals()).toContainEqual(proposal2);
      expect(proposalsBatch.getProposals()).not.toContainEqual(proposal1);
    });
  });
  describe("Getting Proposals", () => {
    it.todo("should get the set of proposal grouped by provider id and sorted by price", async () => {});
  });
});
