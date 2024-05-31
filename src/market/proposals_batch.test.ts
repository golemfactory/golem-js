import { ProposalsBatch } from "./proposals_batch";
import { mock, instance, when } from "@johanblumenberg/ts-mockito";
import { OfferProposal } from "./offer-proposal";
import { ProviderInfo } from "./agreement";
import { ProposalProperties } from "./proposal-properties";

const mockedProviderInfo: ProviderInfo = {
  id: "provider-id-1",
  name: "provider-name-1",
  walletAddress: "0x1234566789",
};

describe("ProposalsBatch", () => {
  describe("Adding Proposals", () => {
    it("should add the proposal to the batch from new provider", async () => {
      const proposalsBatch = new ProposalsBatch({ minBatchSize: 1 });
      const mockedProposal = mock(OfferProposal);
      when(mockedProposal.provider).thenReturn(mockedProviderInfo);
      when(mockedProposal.properties).thenReturn({
        ["golem.inf.cpu.cores"]: 1,
        ["golem.inf.cpu.threads"]: 1,
        ["golem.inf.mem.gib"]: 1,
        ["golem.inf.storage.gib"]: 1,
      } as ProposalProperties);
      const proposal = instance(mockedProposal);
      await proposalsBatch.addProposal(proposal);
      const batched = await proposalsBatch.getProposals();
      expect(batched).toContainEqual(proposal);
    });
    it("should not add the proposal to the batch from the existing provider and the same hardware configuration", async () => {
      const proposalsBatch = new ProposalsBatch({ releaseTimeoutMs: 100 });
      const mockedProposal = mock(OfferProposal);
      when(mockedProposal.provider).thenReturn(mockedProviderInfo);
      when(mockedProposal.properties).thenReturn({
        ["golem.inf.cpu.cores"]: 1,
        ["golem.inf.cpu.threads"]: 1,
        ["golem.inf.mem.gib"]: 1,
        ["golem.inf.storage.gib"]: 1,
      } as ProposalProperties);
      const proposal1 = instance(mockedProposal);
      const proposal2 = instance(mockedProposal);
      await proposalsBatch.addProposal(proposal1);
      await proposalsBatch.addProposal(proposal2);
      const batched = await proposalsBatch.getProposals();
      expect(batched.length).toEqual(1);
    });

    it("should add the proposal to the batch from the existing provider and different hardware configuration", async () => {
      const proposalsBatch = new ProposalsBatch({ minBatchSize: 2 });
      const mockedProposal1 = mock(OfferProposal);
      when(mockedProposal1.provider).thenReturn(mockedProviderInfo);
      when(mockedProposal1.properties).thenReturn({
        ["golem.inf.cpu.cores"]: 1,
        ["golem.inf.cpu.threads"]: 1,
        ["golem.inf.mem.gib"]: 1,
        ["golem.inf.storage.gib"]: 1,
      } as ProposalProperties);
      const mockedProposal2 = mock(OfferProposal);
      when(mockedProposal2.provider).thenReturn(mockedProviderInfo);
      when(mockedProposal2.properties).thenReturn({
        ["golem.inf.cpu.cores"]: 77,
        ["golem.inf.cpu.threads"]: 77,
        ["golem.inf.mem.gib"]: 77,
        ["golem.inf.storage.gib"]: 77,
      } as ProposalProperties);
      const proposal1 = instance(mockedProposal1);
      const proposal2 = instance(mockedProposal2);
      await proposalsBatch.addProposal(proposal1);
      await proposalsBatch.addProposal(proposal2);
      const batched = await proposalsBatch.getProposals();

      expect(batched.length).toEqual(2);
      expect(batched).toContainEqual(proposal1);
      expect(batched).toContainEqual(proposal2);
    });
  });
  describe("Reading Proposals", () => {
    it("should read the set of proposals grouped by provider key distinguished by provider id, cpu, threads, memory and storage", async () => {
      const proposalsBatch = new ProposalsBatch({ releaseTimeoutMs: 100 });
      const mockedProposal1 = mock(OfferProposal);
      when(mockedProposal1.provider).thenReturn(mockedProviderInfo);
      when(mockedProposal1.properties).thenReturn({
        ["golem.inf.cpu.cores"]: 1,
        ["golem.inf.cpu.threads"]: 1,
        ["golem.inf.mem.gib"]: 1,
        ["golem.inf.storage.gib"]: 1,
      } as ProposalProperties);
      const mockedProposal2 = mock(OfferProposal);
      when(mockedProposal2.provider).thenReturn(mockedProviderInfo);
      when(mockedProposal2.properties).thenReturn({
        ["golem.inf.cpu.cores"]: 1,
        ["golem.inf.cpu.threads"]: 1,
        ["golem.inf.mem.gib"]: 1,
        ["golem.inf.storage.gib"]: 1,
      } as ProposalProperties);
      const mockedProposal3 = mock(OfferProposal);
      when(mockedProposal3.provider).thenReturn(mockedProviderInfo);
      when(mockedProposal3.properties).thenReturn({
        ["golem.inf.cpu.cores"]: 1,
        ["golem.inf.cpu.threads"]: 77,
        ["golem.inf.mem.gib"]: 1,
        ["golem.inf.storage.gib"]: 1,
      } as ProposalProperties);
      const mockedProposal4 = mock(OfferProposal);
      when(mockedProposal4.provider).thenReturn(mockedProviderInfo);
      when(mockedProposal4.properties).thenReturn({
        ["golem.inf.cpu.cores"]: 1,
        ["golem.inf.cpu.threads"]: 1,
        ["golem.inf.mem.gib"]: 77,
        ["golem.inf.storage.gib"]: 1,
      } as ProposalProperties);
      const mockedProposal5 = mock(OfferProposal);
      when(mockedProposal5.provider).thenReturn(mockedProviderInfo);
      when(mockedProposal5.properties).thenReturn({
        ["golem.inf.cpu.cores"]: 1,
        ["golem.inf.cpu.threads"]: 1,
        ["golem.inf.mem.gib"]: 1,
        ["golem.inf.storage.gib"]: 77,
      } as ProposalProperties);
      const mockedProposal6 = mock(OfferProposal);
      when(mockedProposal6.provider).thenReturn({ id: "provider-77" } as ProviderInfo);
      when(mockedProposal6.properties).thenReturn({
        ["golem.inf.cpu.cores"]: 1,
        ["golem.inf.cpu.threads"]: 1,
        ["golem.inf.mem.gib"]: 1,
        ["golem.inf.storage.gib"]: 1,
      } as ProposalProperties);
      const proposal1 = instance(mockedProposal1);
      const proposal2 = instance(mockedProposal2);
      const proposal3 = instance(mockedProposal3);
      const proposal4 = instance(mockedProposal4);
      const proposal5 = instance(mockedProposal5);
      const proposal6 = instance(mockedProposal6);
      await Promise.all([
        proposalsBatch.addProposal(proposal1),
        proposalsBatch.addProposal(proposal3),
        proposalsBatch.addProposal(proposal4),
        proposalsBatch.addProposal(proposal5),
        proposalsBatch.addProposal(proposal6),
      ]);

      const batched = await proposalsBatch.getProposals();

      expect(batched.length).toEqual(5);
      expect(batched).toContainEqual(proposal1);
      expect(batched).not.toContainEqual(proposal2);
      expect(batched).toContainEqual(proposal3);
      expect(batched).toContainEqual(proposal4);
      expect(batched).toContainEqual(proposal5);
      expect(batched).toContainEqual(proposal6);
    });
    it("should read the set of proposal grouped by provider key and reduced proposals from teh same provider to the lowest price and highest time", async () => {
      const proposalsBatch = new ProposalsBatch({ releaseTimeoutMs: 100 });
      const mockedProposal1 = mock(OfferProposal);
      when(mockedProposal1.provider).thenReturn(mockedProviderInfo);
      when(mockedProposal1.properties).thenReturn({
        ["golem.inf.cpu.cores"]: 1,
        ["golem.inf.cpu.threads"]: 1,
        ["golem.inf.mem.gib"]: 1,
        ["golem.inf.storage.gib"]: 1,
      } as ProposalProperties);
      when(mockedProposal1.pricing).thenReturn({
        cpuSec: 1,
        envSec: 1,
        start: 1,
      });
      when(mockedProposal1.timestamp).thenReturn("2024-01-01T00:00:00.000Z");
      const mockedProposal2 = mock(OfferProposal);
      when(mockedProposal2.provider).thenReturn(mockedProviderInfo);
      when(mockedProposal2.properties).thenReturn({
        ["golem.inf.cpu.cores"]: 1,
        ["golem.inf.cpu.threads"]: 1,
        ["golem.inf.mem.gib"]: 1,
        ["golem.inf.storage.gib"]: 1,
      } as ProposalProperties);
      when(mockedProposal2.pricing).thenReturn({
        cpuSec: 1,
        envSec: 1,
        start: 1,
      });
      when(mockedProposal2.timestamp).thenReturn("2024-01-01T07:07:07.007Z");
      const mockedProposal3 = mock(OfferProposal);
      when(mockedProposal3.provider).thenReturn(mockedProviderInfo);
      when(mockedProposal3.properties).thenReturn({
        ["golem.inf.cpu.cores"]: 1,
        ["golem.inf.cpu.threads"]: 1,
        ["golem.inf.mem.gib"]: 1,
        ["golem.inf.storage.gib"]: 1,
      } as ProposalProperties);
      when(mockedProposal3.pricing).thenReturn({
        cpuSec: 2,
        envSec: 2,
        start: 2,
      });
      when(mockedProposal3.timestamp).thenReturn("2024-01-01T07:07:07.007Z");
      const proposal1 = instance(mockedProposal1);
      const proposal2 = instance(mockedProposal2);
      const proposal3 = instance(mockedProposal3);
      await proposalsBatch.addProposal(proposal1);
      await proposalsBatch.addProposal(proposal2);
      await proposalsBatch.addProposal(proposal3);

      const batched = await proposalsBatch.getProposals();

      expect(batched.length).toEqual(1);
      expect(batched).toContainEqual(proposal2);
      expect(batched).not.toContainEqual(proposal1);
      expect(batched).not.toContainEqual(proposal3);
    });
    it("should drain batch after reading proposals", async () => {
      const proposalsBatch = new ProposalsBatch({ releaseTimeoutMs: 100 });
      const mockedProposal = mock(OfferProposal);
      when(mockedProposal.provider).thenReturn(mockedProviderInfo);
      when(mockedProposal.properties).thenReturn({
        ["golem.inf.cpu.cores"]: 1,
        ["golem.inf.cpu.threads"]: 1,
        ["golem.inf.mem.gib"]: 1,
        ["golem.inf.storage.gib"]: 1,
      } as ProposalProperties);
      const proposal = instance(mockedProposal);
      await proposalsBatch.addProposal(proposal);

      expect((await proposalsBatch.getProposals()).length).toEqual(1);
      expect((await proposalsBatch.getProposals()).length).toEqual(0);
      await proposalsBatch.addProposal(proposal);
      await proposalsBatch.addProposal(proposal);
      expect((await proposalsBatch.getProposals()).length).toEqual(1);
      expect((await proposalsBatch.getProposals()).length).toEqual(0);
    });
  });
});
